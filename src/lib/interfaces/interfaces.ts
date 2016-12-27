import * as express from "express";

/**
 * Every ModelFactory class MUST implements this interface.
 * 
 * This class is a really centric point of the framework !!!
 * 
 * Every information that have been computed by the decorators and the typescript compiler 
 * regarding the class definitions (with @collection decorator) are stored in memory in one instance of ModelFactory.
 * 
 * An instance of IModelFactory would be created for each model registered.
 */
export interface IModelFactory {
    /** 
     * The target class is the transpiled module corresponding to the model class registered by the factory.
     * 
     * It SHOULD NOT be used directly except by the framework itself...
     * But if really necessary, it CAN be as the following :
     * 
     * To create an instance :
     * 
     *   ```js
     *   let inst = new this.targetClass.prototype.constructor();`
     *   ```
     * 
     * Or to call a static :
     * 
     *   ```js
     *   this.targetClass['property'](params);`
     *   ```
     */
    targetClass: any;
    /**
     * The collection name corresponds to the model's class name.
     */
    collectionName: string;
    /**
     * The datasource is specified depending on the connector's type
     */
    datasource: string;
    /**
     * The connector itself. It will be used to retrieve connections.
     */
    connector: IConnector;
    /**
     * A string array that contains all the class singular properties names.
     */
    $properties: string[];
    /**
     * A string array that contains all the class plural properties names.
     */
    $plurals: string[];
    /**
     * A Map of IFields objects is computed during the factory initialization.
     * 
     * These objects allows to get useful informations computed by the compiler 
     * regarding the decorators that could have been used in the model's class.
     */
    $fields: Map<string, IField>;
    /**
     * A string array that contains all the class public/protected and static functions names.
     */
    $statics: string[];
    /**
     * A string array that contains all the class public/protected and non static functions names.
     */
    $methods: string[];
    /**
     * A string array that contains all the functions names that have been set with @route decorator.
     */
    $routes: IRoute[];
    /**
     * An object that contains all the class properties names (singular AND plural) which type reference another registered class.
     */
    $references: any;
    /**
     * An Map that contains all the functions that have been set with @hook decorator.
     * 
     * At least two hooks are handled by the ModelHelperBase `beforeSave` and `afterSave` when performing save actions (save and update).
     */
    $hooks: Map<string, Function>;
    /**
     * The complete schema of the target class.
     * 
     * It has been implemented matching to mongoose schema (with some extras).
     */
    $prototype: any;
    /**
     * The ModelActions instance that is responsible for interacting with datasource.
     * 
     * It is the instance that would be in charge for CRUD operations.
     * 
     * Normally, it SHOULD NOT be used directly because lot of 
     * controls (serialization, validation, ...) SHOULD BE managed by the ModelHelper instance.
     */
    actions: IModelActions;
    /**
     * The ModelHelper instance that would be the main entry point for manipulating model's instances.
     * 
     * It is responsible for serializing before save/update actions and updating values 
     * after reading data from the remote datasources.
     */
    helper: IModelHelper;
    /**
     * The ModelController instance that contains all express routes handlers for CRUD operations.
     * 
     * All actions executed by the handlers MUST pass through the ModelHelper and NOT DIRECTLY with ModelActions instance.
     */
    controller: IModelController;
    /**
     * Store the ModelActions, the ModelHelper and the ModelController locally if the factory is persistent.
     * 
     * It also initialize express requests handlers defined in ModelController for CRUD operations.
     * @param Map<string, express.Router> Several express Routers could be passed here, but ModelFactoryBase implementation only use `v1` Router created by the Middleware.
     * @param IModelActions An IModelActions instance which is responsible for datasource CRUD operations.
     * @param IModelHelper An IModelHelper instance which is reponsible for integrity and synchronization 
     * after receiving or before sending data when calling IModelActions operations.
     * @param IModelController An IModelController instance which MUST implements all request handlers for CRUD operations.
     */
    init(actions: IModelActions, helper: IModelHelper, controller: IModelController);
    /**
     * MUST be implemented by connectors ModelFactory to handle specific needs related to the connector itself.
     * 
     * Usually initializes connection with a remote server.
     * @param Map<string, express.Router> Several express Routers could be passed here.
     */
    setup();
    /**
     * Allows to retrieve ModelFactory corresponding to a reference field.
     * @param string The property reference name as it is defined in the model's class.
     * @return IModelFactory The model's factory in charge of the reference's type.
     */
    getModelFactoryByPath(path: string): IModelFactory;
    /**
     * Allows to get reference's type.
     * @param string The property reference name as it is defined in the model's class.
     * @return The stringified type of the property.
     */
    getReferenceType(refName: string): string;
    /**
     * A kind of helper that allows to make a new instance.
     * If a type is provided the instance created will be of the specified reference type.
     * 
     * It is also possible to pass data directly during this call.
     * @param string `optional` The data as JSON format to set on the instance.
     * @param string `optional` The reference's stringified type.
     */
    createNew(data?: any, type?: string): any;
    /**
     * Allows to get the hook function matching to a name.
     * 
     *   eg: 
     *   ```js
     *   let fn: Function = this.modelFactory.getHookFunction(name);
     *   fn(myParams);
     *   ```
     * @param string the hook's name.
     * @return Function The hook function that could be called.
     */
    getHookFunction(name: string): Function;
    /** 
     * Transform a reference id to serialized child object.
     * @param IParameters Defines what properties to includes specifying `includes` and `select`parameters.
     * @param any The data where the population will be done.
     * @param string The property key to populate.
     */
    populateField(parameters: IParameters, item: any, key: string): void;
    /**
     * The reverse action to populateFiled. It will set the _id property instead of a full child serialized object.
     * @param any The full serialized object.
     * @return any The full serialized object without serialized references.
     */
    simplifyReferences(item: any): any;
}

/**
 * Every ModelController class MUST implements this interface.
 * 
 * It is the class responsible for every request handlers definition.
 * Basically, the CRUD operations should be defined.
 */
export interface IModelController {
    /**
     * The request handler that create a record.
     */
    create: express.RequestHandler;
    /**
     * The request handler that update a record (deleting missing properties).
     */
    update: express.RequestHandler;
    /**
     * The request handler that update a record (keeping missing properties).
     */
    patch: express.RequestHandler;
    /**
     * The request handler that delete a record.
     */
    delete: express.RequestHandler;
    /**
     * The request handler that read a record.
     */
    read: express.RequestHandler;
    /**
     * The request handler that list records.
     */
    query: express.RequestHandler;
}

/**
 * Every ModelActions class MUST implements this interface.
 * 
 * THIS CLASS SHOULD NOT BE USED DIRECTLY. IT WOULD PREFERRED TO USE MODEL HELPER CLASS INSTEAD !!!
 * 
 * It is the class responsible for every specifics datasource client actions.
 * Basically, the CRUD operations should be defined.
 */
export interface IModelActions {
    /**
     * List all the records matching a filter.
     * @param any `optional` The filter object can define what record would be returned regarding key/value pairs.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @return any An array of records.
     */
    query(filter?: any, parameters?: IParameters): any[];
    /**
     * Read a record matching a filter.
     * @param any The filter object can define what record would be returned regarding key/value pairs.
     * If `filter` parameter is a string, the `_id` property is used for selection.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @return any A record.
     */
    read(filter: any, parameters?: IParameters): any;
    /**
     * Create a new record passing some data.
     * @param any Data to set on the record.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @return any The created record.
     */
    create(item: any, options?: any): any;
    /**
     * Update an existing record passing some data.
     * @param any Data to set on the record.
     * @param IParameters `optional` Can be used to consider only one reference, 
     * for populating and for missing properties deletion.
     * @return any The updated record.
     */
    update(_id: string, item: any, options?: any): any;
    /**
     * Delete an existing record.
     * @param any The _id of the record.
     * @return any Status information.
     */
    delete(_id: any): any;
    //count(filter: any): number;
}

export interface IModelHelper {
    /**
     * Get all the instances matching a filter from the model's datasource.
     * @param any `optional` The filter object can define what instances would be returned regarding key/value pairs.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @param ISerializeOptions `optional` Allows to define specific serialization behaviour.
     * @return any An array of instances.
     */
    fetchInstances(filter?: any, parameters?: IParameters, serializeOptions?: ISerializeOptions): any[];
    /**
     * Get one instance matching a filter from the model's datasource.
     * @param any `optional` The filter object can define what instance would be returned regarding key/value pairs.
     * If `filter` parameter is a string, the `_id` property is used for selection.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @param ISerializeOptions `optional` Allows to define specific serialization behaviour.
     * @return any An instance.
     */
    fetchInstance(filter: any, parameters?: IParameters, serializeOptions?: ISerializeOptions): any;
    /**
     * Persist instance data into the model's datasource.
     * @param any The instance to save.
     * @param any `optional` The data to set on the instance.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @param ISerializeOptions `optional` Allows to define specific serialization behaviour.
     * @return any An instance.
     */
    saveInstance(instance: any, data?: any, options?: IParameters, serializeOptions?: ISerializeOptions): any;
    /**
     * Delete the instance from the model's datasource.
     * @param any The instance to delete.
     * @return any Status information.
     */
    deleteInstance(instance: any): any;
    /**
     * Serialize the instance to JSON object.
     * @param any The instance to serialize.
     * @param IParameters `optional` Can be used to consider only one reference or for populating.
     * @param ISerializeOptions `optional` Allows to define specific serialization behaviour.
     * @return The JSON representation of the instance.
     */
    serialize(instance: any, parameters?: IParameters, options?: ISerializeOptions): any;
    /**
     * Update instance's properties values with JSON object.
     * @param any The instance to update.
     * @param any A JSON object that contains the properties to update.
     * @param any `optional` Some options to define the model factory to use 
     * or if missing properties should be deleted.
     */
    updateValues(instance: any, item: any, options?: any): void;
    /**
     * Get special property value. Is used by ModelBase through getters to return _id, _createdAt and _updatedAt values.
     * @param any The instance to consider.
     * @param any A property name.
     * @return any The value of the instance's property.
     */
    getMetadata(instance: any, metadataName: string): any;
    /**
     * To know if the property has been modified since the last update .
     * @param any The instance to consider.
     * @param any A property name.
     * @return boolean Returns `true` if the property has been modified since the last update.
     */
    isModified(instance: any, property: string): boolean;
}

export interface IField {
    isPlural: boolean;
    isReference: boolean;
    isReverse: boolean;
    isEmbedded: boolean;
    isReadOnly: boolean;
    isUnique: boolean;
    isIndexed: boolean;
    isRequired: boolean;
    isVisible(instance: any): boolean;
}

export interface IRoute {
    method: string;
    path: string;
    fn: Function;
}

export interface IConnector {
    datasource: string;
    config: any;
    connections: Map<string, any>;
    connect(datasourceKey: string): any;
    getConnection(datasourceKey: string);
    cleanDb(cds: string): void;
    createModelFactory(name: string, myClass: any): IModelFactory;
}

export interface IParameters {
    includes?: any;
    ref?: string;
    deleteMissing?: boolean;
    deleteReadOnly?: boolean;
}

export interface ISerializeOptions {
    modelFactory?: IModelFactory;
    serializeRef?: boolean;
    ignorePostSerialization?: boolean;
}