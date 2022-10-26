/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import selectedUpdateChannelInjectable from "../../common/selected-update-channel/selected-update-channel.injectable";
import releaseChannelInjectable from "../../../../common/vars/release-channel.injectable";

const updateCanBeDowngradedInjectable = getInjectable({
  id: "update-can-be-downgraded",

  instantiate: (di) => {
    const selectedUpdateChannel = di.inject(selectedUpdateChannelInjectable);
    const releaseChannel = di.inject(releaseChannelInjectable);

    return computed(() => (
      selectedUpdateChannel.value.get().id === "latest"
      && releaseChannel.get() !== "latest"
    ));
  },
});

export default updateCanBeDowngradedInjectable;
