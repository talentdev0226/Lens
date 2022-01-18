/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import type { LensProtocolRouterRenderer } from "../lens-protocol-router-renderer/lens-protocol-router-renderer";
import { navigate } from "../../navigation/helpers";
import { catalogEntityRegistry } from "../../api/catalog-entity-registry";
import { ClusterStore } from "../../../common/cluster-store/cluster-store";
import {
  EXTENSION_NAME_MATCH,
  EXTENSION_PUBLISHER_MATCH,
  LensProtocolRouter,
} from "../../../common/protocol-handler";
import { Notifications } from "../../components/notifications";
import * as routes from "../../../common/routes";
import type { ExtensionInfo } from "../../components/+extensions/attempt-install-by-info/attempt-install-by-info";

interface Dependencies {
  attemptInstallByInfo: (extensionInfo: ExtensionInfo) => Promise<void>;
  lensProtocolRouterRenderer: LensProtocolRouterRenderer;
}

export const bindProtocolAddRouteHandlers =
  ({ attemptInstallByInfo, lensProtocolRouterRenderer }: Dependencies) =>
    () => {
      lensProtocolRouterRenderer
        .addInternalHandler("/preferences", ({ search: { highlight }}) => {
          navigate(routes.preferencesURL({ fragment: highlight }));
        })
        .addInternalHandler("/", ({ tail }) => {
          if (tail) {
            Notifications.shortInfo(
              <p>
              Unknown Action for <code>lens://app/{tail}</code>. Are you on the
              latest version?
              </p>,
            );
          }

          navigate(routes.catalogURL());
        })
        .addInternalHandler("/landing", () => {
          navigate(routes.catalogURL());
        })
        .addInternalHandler(
          "/landing/view/:group/:kind",
          ({ pathname: { group, kind }}) => {
            navigate(
              routes.catalogURL({
                params: {
                  group,
                  kind,
                },
              }),
            );
          },
        )
        .addInternalHandler("/cluster", () => {
          navigate(routes.addClusterURL());
        })
        .addInternalHandler(
          "/entity/:entityId/settings",
          ({ pathname: { entityId }}) => {
            const entity = catalogEntityRegistry.getById(entityId);

            if (entity) {
              navigate(routes.entitySettingsURL({ params: { entityId }}));
            } else {
              Notifications.shortInfo(
                <p>
                Unknown catalog entity <code>{entityId}</code>.
                </p>,
              );
            }
          },
        )
      // Handlers below are deprecated and only kept for backward compact purposes
        .addInternalHandler(
          "/cluster/:clusterId",
          ({ pathname: { clusterId }}) => {
            const cluster = ClusterStore.getInstance().getById(clusterId);

            if (cluster) {
              navigate(routes.clusterViewURL({ params: { clusterId }}));
            } else {
              Notifications.shortInfo(
                <p>
                Unknown catalog entity <code>{clusterId}</code>.
                </p>,
              );
            }
          },
        )
        .addInternalHandler(
          "/cluster/:clusterId/settings",
          ({ pathname: { clusterId }}) => {
            const cluster = ClusterStore.getInstance().getById(clusterId);

            if (cluster) {
              navigate(
                routes.entitySettingsURL({ params: { entityId: clusterId }}),
              );
            } else {
              Notifications.shortInfo(
                <p>
                Unknown catalog entity <code>{clusterId}</code>.
                </p>,
              );
            }
          },
        )
        .addInternalHandler("/extensions", () => {
          navigate(routes.extensionsURL());
        })
        .addInternalHandler(
          `/extensions/install${LensProtocolRouter.ExtensionUrlSchema}`,
          ({ pathname, search: { version }}) => {
            const name = [
              pathname[EXTENSION_PUBLISHER_MATCH],
              pathname[EXTENSION_NAME_MATCH],
            ]
              .filter(Boolean)
              .join("/");

            navigate(routes.extensionsURL());
            attemptInstallByInfo({ name, version, requireConfirmation: true });
          },
        );
    };
