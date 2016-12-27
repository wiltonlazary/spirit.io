import { Request, Response, NextFunction } from 'express';
import { IConnector, IModelActions, IModelHelper, IModelController, IModelFactory, IField, IRoute, IParameters } from '../interfaces'
import { Registry } from '../core';
import { helper as objectHelper } from '../utils'
import { run } from 'f-promise';
import * as debug from 'debug';
const trace = debug('sio:factory');

class Field implements IField {
    name: string;
    isPlural: boolean = false;
    isReference: boolean = false;
    isReverse: boolean = false;
    isEmbedded: boolean = false;
    isReadOnly: boolean = false;
    isUnique: boolean = false;
    isRequired: boolean = false;
    isIndexed: boolean = false;
    private _invisible: boolean | Function;

    constructor(key: string, factory: IModelFactory) {
        this.name = key;
        if (factory.$plurals.indexOf(key) !== -1) this.isPlural = true;
        if (factory.$references.hasOwnProperty(key)) {
            this.isReference = true;
            if (factory.$references[key].$reverse) this.isReverse = true;
        }

        if (factory.$prototype.hasOwnProperty(key)) {
            this.isReadOnly = factory.$prototype[key].readOnly;
            this.isEmbedded = factory.$prototype[key].embedded;
            this.isUnique = factory.$prototype[key].unique;
            this.isRequired = factory.$prototype[key].required;
            this.isIndexed = factory.$prototype[key].index;
            this._invisible = factory.$prototype[key].invisible != null ? factory.$prototype[key].invisible : false;
        }
    }

    isVisible(instance: any): boolean {
        if (typeof this._invisible === 'boolean') {
            return !<boolean>this._invisible;
        } else {
            return !this._invisible(instance);
        }
    }
}


/**
 * This is an abstract class, so every spirit.io connector MUST provide a ModelFactory class that inherit of this base class.
 */
export abstract class ModelFactoryBase implements IModelFactory {

    public targetClass: any;
    public collectionName: string;
    public connector: IConnector;
    public $properties: string[];
    public $statics: string[];
    public $methods: string[];
    public $routes: IRoute[]
    public $fields: Map<string, IField>;
    public $plurals: string[];
    public $references: any;
    public $prototype: Object;
    public $hooks: Map<string, Function>;
    public actions: IModelActions;
    public helper: IModelHelper;
    public controller: IModelController;
    public datasource: string;
    public persistent: boolean = true;

    constructor(name: string, targetClass: any, connector: IConnector) {
        this.collectionName = name;
        this.targetClass = targetClass;
        this.connector = connector;
        let tempFactory = targetClass.__factory__[name];
        if (tempFactory.persistent != null) this.persistent = tempFactory.persistent;
        if (tempFactory.datasource) this.datasource = tempFactory.datasource;

        this.$prototype = tempFactory.$prototype || {};
        this.$properties = tempFactory.$properties || [];
        this.$plurals = tempFactory.$plurals || [];
        this.$statics = tempFactory.$statics || [];
        this.$methods = tempFactory.$methods || [];
        this.$routes = tempFactory.$routes || [];
        this.$references = tempFactory.$references || {};
        this.$hooks = tempFactory.$hooks || new Map();
        this.$fields = new Map();
    }

    init(actions: IModelActions, helper: IModelHelper, controller: IModelController): void {
        trace(`============= Prototype registered for collection ${this.collectionName} =============\n${require('util').inspect(this.$prototype, null, 2)}`)

        // compute fields
        this.$properties.concat(Object.keys(this.$references)).forEach((key) => {
            this.$fields.set(key, new Field(key, this));
        });

        let routeName = this.collectionName.substring(0, 1).toLowerCase() + this.collectionName.substring(1);
        let v1 = Registry.getApiRouter('v1');

        if (this.persistent) {
            this.actions = actions;
            this.helper = helper;
            this.controller = controller;

            if (this.actions) {
                trace(`--> Register routes: /${routeName}`);
                // handle main requests
                v1.get(`/${routeName}`, this.controller.query);
                v1.get(`/${routeName}/:_id`, this.controller.read);
                v1.post(`/${routeName}`, this.controller.create);
                v1.put(`/${routeName}/:_id`, this.controller.update);
                v1.patch(`/${routeName}/:_id`, this.controller.patch);
                v1.delete(`/${routeName}/:_id`, this.controller.delete);
                // handle references requests
                v1.get(`/${routeName}/:_id/:_ref`, this.controller.read);
                v1.put(`/${routeName}/:_id/:_ref`, this.controller.update);
                v1.patch(`/${routeName}/:_id/:_ref`, this.controller.patch);
            }

            // handle instance functions
            v1.post(`/${routeName}/:_id/([\$])execute/:_name`, this.executeMethod.bind(this) as any);
        }

        // handle static functions (available also on non persistent classes)
        v1.post(`/${routeName}/([\$])service/:_name`, this.executeService.bind(this) as any);
        this.$routes.forEach((route: IRoute) => {
            let path = `/${routeName}${route.path}`;
            v1[route.method](path, route.fn);
        });

    }

    getModelFactoryByPath(path: string): IModelFactory {
        let _treeEntry = this.$prototype[path];
        let _ref = _treeEntry ? (Array.isArray(_treeEntry) ? _treeEntry[0].ref : _treeEntry.ref) : null;
        if (!_ref) throw new Error(`path '${path}' not found in '${this.collectionName}' factory's prototype`);

        // specifying model when populate is necessary for multiple database usage
        let mf = Registry.getFactory(_ref);
        if (!mf) throw new Error(`Class hasn't been registered for model '${path}'.`);
        return mf;
    }

    getReferenceType(refName: string): string {
        let typeIsPlural = this.$plurals.indexOf(refName) !== -1;
        return this.$prototype[refName] && (typeIsPlural ? this.$prototype[refName][0] && this.$prototype[refName][0].ref : this.$prototype[refName].ref);
    }

    createNew(data?: any, type?: string): any {
        let mf = type == null ? this : Registry.getFactory(type);
        let constructor = mf.targetClass.prototype.constructor;
        if (data instanceof constructor) {
            return data;
        } else if (typeof data === 'string') {
            data = {
                _id: data
            };
        }
        //console.log(`Instanciate reference ${type} with data: ${require('util').inspect(data, null, 2)}`);
        let inst = new constructor();
        if (data) mf.helper.updateValues(inst, data, { deleteMissing: true });
        return inst;
    }

    getHookFunction(name: string): Function {
        return this.$hooks.get(name);
    }

    populateField(parameters: IParameters = {}, item: any = {}, key: string): void {
        let include = parameters.includes && parameters.includes.filter((i) => { return i.path === key; })[0];
        if (include && item && item[key] != null) {
            let mf = this.getModelFactoryByPath(key);
            let relValue;
            if (Array.isArray(item[key])) {
                relValue = [];
                item[key].forEach((id) => {
                    let ref = mf.actions.read(id);
                    if (include.select) {
                        let data = { _id: ref._id };
                        data[include.select] = ref[include.select];
                        relValue.push(data);
                    } else {
                        relValue.push(ref);
                    }
                });
            } else {
                let ref = mf.actions.read(item[key]);
                if (include.select) {
                    let data = { _id: ref._id };
                    data[include.select] = ref[include.select];
                    relValue = data;
                } else {
                    relValue = ref;
                }
            }
            item[key] = relValue;
        }
    }

    simplifyReferences(item: any): any {
        let transformed = objectHelper.clone(item, true);
        Object.keys(this.$references).forEach((key) => {
            if (transformed && transformed[key] != null) {
                let relValue;
                if (Array.isArray(transformed[key])) {
                    relValue = [];
                    transformed[key].forEach((it) => {
                        if (typeof it === 'object' && it._id) relValue.push(it._id);
                        else relValue.push(it);
                    });
                } else {
                    if (typeof transformed[key] === 'object' && transformed[key]._id) relValue = transformed[key]._id;
                    else relValue = transformed[key];
                }
                transformed[key] = relValue;
            }
        });
        return transformed;
    }

    private executeService(req: Request, res: Response, next: NextFunction): void {
        run(() => {
            let _name: string = req.params['_name'];
            if (this.$statics.indexOf(_name) === -1 || !this.targetClass[_name]) {
                res.sendStatus(404);
                return;
            }
            let params = req.body;
            let result = this.targetClass[_name](params);
            res.json(result);
            next();
        }).catch(e => {
            next(e);
        });
    }

    private executeMethod(req: Request, res: Response, next: NextFunction): void {
        run(() => {
            let _id: string = req.params['_id'];
            let _name: string = req.params['_name'];
            let inst = this.helper.fetchInstance(_id);
            if (this.$methods.indexOf(_name) === -1 || !inst || (inst && !inst[_name])) {
                res.sendStatus(404);
                return;
            }

            let params = req.body;
            let result = inst[_name](params);
            res.json(result);
            next();
        }).catch(e => {
            next(e);
        });
    }

    abstract setup(): void;


}


export class NonPersistentModelFactory extends ModelFactoryBase implements IModelFactory {
    constructor(name: string, targetClass: any, connector: IConnector) {
        super(name, targetClass, connector);
    }
    setup() {
        super.init(null, null, null);
    }
}