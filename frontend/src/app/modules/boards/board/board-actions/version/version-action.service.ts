import {Injectable} from "@angular/core";
import {Board} from "core-app/modules/boards/board/board";
import {QueryResource} from "core-app/modules/hal/resources/query-resource";
import {BoardActionService} from "core-app/modules/boards/board/board-actions/board-action.service";
import {HalResource} from "core-app/modules/hal/resources/hal-resource";
import {VersionResource} from "core-app/modules/hal/resources/version-resource";
import {VersionDmService} from "core-app/modules/hal/dm-services/version-dm.service";
import {VersionAutocompleterComponent} from "core-app/modules/common/autocomplete/version-autocompleter.component";
import {OpContextMenuItem} from "core-components/op-context-menu/op-context-menu.types";
import {LinkHandling} from "core-app/modules/common/link-handling/link-handling";
import {StateService} from "@uirouter/core";
import {HalResourceNotificationService} from "core-app/modules/hal/services/hal-resource-notification.service";
import {VersionCacheService} from "core-components/versions/version-cache.service";
import {VersionBoardHeaderComponent} from "core-app/modules/boards/board/board-actions/version/version-board-header.component";
import {FormResource} from "core-app/modules/hal/resources/form-resource";
import {FormsCacheService} from "core-components/forms/forms-cache.service";
import {InjectField} from "core-app/helpers/angular/inject-field.decorator";

@Injectable()
export class BoardVersionActionService extends BoardActionService {
  @InjectField() versionCache:VersionCacheService;
  @InjectField() versionDm:VersionDmService;
  @InjectField() state:StateService;
  @InjectField() formCache:FormsCacheService;
  @InjectField() halNotification:HalResourceNotificationService;

  filterName = 'version';

  public get localizedName() {
    return this.I18n.t('js.work_packages.properties.version');
  }

  public canAddToQuery(query:QueryResource):Promise<boolean> {
    const formLink = _.get(query, 'results.createWorkPackage.href', null);

    if (!formLink) {
      return Promise.resolve(false);
    }

    return this.formCache
      .require(formLink)
      .then((form:FormResource) => form.schema.version.writable);
  }

  public addActionQueries(board:Board):Promise<Board> {
    return this.withLoadedAvailable()
      .then((results) => {
        return Promise.all<unknown>(
          results.map((version:VersionResource) => {
            const definingName = _.get(version, 'definingProject.name', null);
            if (version.isOpen() && definingName && definingName === this.currentProject.name) {
              return this.addActionQuery(board, version);
            }

            return Promise.resolve(board);
          })
        )
          .then(() => board);
      });
  }

  /**
   * Adds an entry to the list menu to edit the version if allowed
   * @param {QueryResource} query The active query
   * @returns {Promise<any>}
   */
  public getAdditionalListMenuItems(query:QueryResource):Promise<OpContextMenuItem[]> {
    return this
      .getLoadedFilterValue(query)
      .then((version:VersionResource) => {
        if (version) {
          return this.buildItemsForVersion(version);
        } else {
          return [];
        }
      });
  }

  public autocompleterComponent() {
    return VersionAutocompleterComponent;
  }

  public headerComponent() {
    return VersionBoardHeaderComponent;
  }

  public disabledAddButtonPlaceholder(version:VersionResource) {
    if (version.isLocked()) {
      return { icon: 'locked', text: this.I18n.t('js.boards.version.locked') };
    } else if (version.isClosed()) {
      return { icon: 'not-supported', text: this.I18n.t('js.boards.version.closed') };
    } else {
      return undefined;
    }
  }

  public dragIntoAllowed(query:QueryResource, value:HalResource|undefined) {
    return value instanceof VersionResource && value.isOpen();
  }

  protected loadAvailable():Promise<VersionResource[]> {
    if (this.currentProject.id === null) {
      return Promise.resolve([]);
    }

    return this.versionDm
      .listForProject(this.currentProject.id)
      .then(collection => collection.elements);
  }

  private patchVersionStatus(version:VersionResource, newStatus:'open'|'closed'|'locked') {
    this.versionDm
      .patch(version, { status: newStatus })
      .then((version) => {
        this.versionCache.updateValue(version.id!, version);
        this.state.go('.', {}, { reload: true });
      })
      .catch(error => this.halNotification.handleRawError(error));
  }

  private buildItemsForVersion(version:VersionResource):OpContextMenuItem[] {
    const id = version.id!;
    return [
      {
        // Lock version
        hidden: !version.isOpen() || (version.isLocked() && !version.$links.update),
        linkText: this.I18n.t('js.boards.version.lock_version'),
        onClick: () => {
          this.patchVersionStatus(version, 'locked');
          return true;
        }
      },
      {
        // Unlock version
        hidden: !version.isLocked() || (version.isOpen() && !version.$links.update),
        linkText: this.I18n.t('js.boards.version.unlock_version'),
        onClick: () => {
          this.patchVersionStatus(version, 'open');
          return true;
        }
      },
      {
        // Close version
        hidden: version.isClosed() || (!version.isClosed() && !version.$links.update),
        linkText: this.I18n.t('js.boards.version.close_version'),
        onClick: () => {
          this.patchVersionStatus(version, 'closed');
          return true;
        }
      },
      {
        // Open version
        hidden: !version.isClosed() || (version.isClosed() && !version.$links.update),
        linkText: this.I18n.t('js.boards.version.open_version'),
        onClick: () => {
          this.patchVersionStatus(version, 'open');
          return true;
        }
      },
      {
        // Show link
        linkText: this.I18n.t('js.boards.version.show_version'),
        href: this.pathHelper.versionShowPath(id),
        onClick: (evt:JQuery.TriggeredEvent) => {
          if (!LinkHandling.isClickedWithModifier(evt)) {
            window.open(this.pathHelper.versionShowPath(id), '_blank');
            return true;
          }

          return false;
        }
      },
      {
        // Edit link
        hidden: !version.$links.update,
        linkText: this.I18n.t('js.boards.version.edit_version'),
        href: this.pathHelper.versionEditPath(id),
        onClick: (evt:JQuery.TriggeredEvent) => {
          if (!LinkHandling.isClickedWithModifier(evt)) {
            window.open(this.pathHelper.versionEditPath(id), '_blank');
            return true;
          }

          return false;
        }
      }
    ];
  }
}
