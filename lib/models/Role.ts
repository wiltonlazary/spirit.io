import { collection, unique, required } from '../decorators';
import { ModelBase } from '../base/modelBase';

/**
 * User class
 */
@collection("Role")
export class Role extends ModelBase {
    
    @unique @required
    title: string;

    description: string


}
//Object.seal(User);