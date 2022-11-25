/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectionToken } from "@ogre-tools/injectable";
import type { MessageChannel } from "./message-channel-listener-injection-token";

export interface SendMessageToChannel {
  (channel: MessageChannel<void>): void;
  <Message>(channel: MessageChannel<Message>, message: Message): void;
}

export type MessageChannelSender<Channel> = Channel extends MessageChannel<void | undefined>
  ? () => void
  : Channel extends MessageChannel<infer Message>
    ? (message: Message) => void
    : never;

export const sendMessageToChannelInjectionToken = getInjectionToken<SendMessageToChannel>({
  id: "send-message-to-message-channel",
});
