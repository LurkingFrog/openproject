import {Injector} from "@angular/core";
import {Constructor} from "@angular/cdk/table";
import {SimpleResource, SimpleResourceCollection} from "core-app/modules/apiv3/paths/path-resources";
import {InjectField} from "core-app/helpers/angular/inject-field.decorator";
import {HalResourceService} from "core-app/modules/hal/services/hal-resource.service";
import {ApiV3FilterBuilder} from "core-components/api/api-v3/api-v3-filter-builder";
import {HalResource} from "core-app/modules/hal/resources/hal-resource";
import {Observable} from "rxjs";
import {APIV3Service} from "core-app/modules/apiv3/api-v3.service";

export class APIv3ResourcePath<T extends HalResource = HalResource> extends SimpleResource {
  readonly injector = this.apiRoot.injector;
  @InjectField() halResourceService:HalResourceService;

  constructor(protected apiRoot:APIV3Service,
              readonly basePath:string,
              readonly id:string|number,
              protected parent?:APIv3ResourcePath|APIv3ResourceCollection<any, any>) {
    super(basePath, id);
  }


  /**
   * Build a singular resource from the current segment
   *
   * @param segment Additional segment to add to the current path
   */
  protected subResource<R = APIv3GettableResource<HalResource>>(segment:string, cls:Constructor<R> = APIv3GettableResource as any):R {
    return new cls(this.apiRoot, this.path, segment, this);
  }
}


export class APIv3GettableResource<T extends HalResource = HalResource> extends APIv3ResourcePath<T> {
  /**
   * Perform a request to the HalResourceService with the current path
   */
  public get():Observable<T> {
    return this
      .halResourceService
      .get<T>(this.path);
  }
}

export class APIv3ResourceCollection<V extends HalResource, T extends APIv3GettableResource<V>> extends SimpleResourceCollection {
  readonly injector = this.apiRoot.injector;
  @InjectField() halResourceService:HalResourceService;

  constructor(protected apiRoot:APIV3Service,
              protected basePath:string,
              segment:string,
              protected resource?:Constructor<T>) {
    super(basePath, segment);
  }

  /**
   * Returns an instance of T for the given singular resource ID.
   *
   * @param id
   */
  public id(id:string|number):T {
    return new (this.resource || APIv3GettableResource)(this.apiRoot, this.path, id, this) as T;
  }


  public withOptionalId(id?:string|number):this|T {
    if (_.isNil(id)) {
      return this;
    } else {
      return this.id(id);
    }
  }

  /**
   * Returns the path string to the requested endpoint.
   */
  public toString():string {
    return this.path;
  }

  /**
   * Returns the path string to the requested endpoint.
   */
  public toPath():string {
    return this.path;
  }

  /**
   * Returns a new resource with the path extended with a URL query
   * to match the filters.
   */
  public filtered<R extends HalResource = V>(filters:ApiV3FilterBuilder):Observable<R> {
    return this.subResource<R>('/?' + filters.toParams()).get();
  }

  /**
   * Build a singular resource from the current segment
   *
   * @param segment Additional segment to add to the current path
   */
  protected subResource<R = APIv3GettableResource<HalResource>>(segment:string, cls:Constructor<R> = APIv3GettableResource as any):R {
    return new cls(this.apiRoot, this.path, segment);
  }
}