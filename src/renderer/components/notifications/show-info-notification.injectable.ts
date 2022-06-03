/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import type { NotificationMessage, Notification } from "./notifications.store";
import { NotificationStatus } from "./notifications.store";
import notificationsStoreInjectable from "./notifications-store.injectable";

const showInfoNotificationInjectable = getInjectable({
  id: "show-info-notification",

  instantiate: (di) => {
    const notificationsStore = di.inject(notificationsStoreInjectable);

    return (message: NotificationMessage, customOpts: Partial<Omit<Notification, "message">> = {}) =>
      notificationsStore.add({
        status: NotificationStatus.INFO,
        timeout: 5000,
        message,
        ...customOpts,
      });
  },
});

export default showInfoNotificationInjectable;
