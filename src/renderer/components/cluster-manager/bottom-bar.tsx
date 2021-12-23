/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import styles from "./bottom-bar.module.scss";

import React from "react";
import { observer } from "mobx-react";
import { StatusBarRegistration, StatusBarRegistry } from "../../../extensions/registries";
import { cssNames } from "../../utils";

@observer
export class BottomBar extends React.Component {
  renderRegisteredItem(registration: StatusBarRegistration) {
    const { item } = registration;

    if (item) {
      return typeof item === "function" ? item() : item;
    }

    return <registration.components.Item />;
  }

  renderRegisteredItems() {
    const items = StatusBarRegistry.getInstance().getItems();

    if (!Array.isArray(items)) {
      return null;
    }

    items.sort(function sortLeftPositionFirst(a, b) {
      return a.components?.position?.localeCompare(b.components?.position);
    });

    return (
      <>
        {items.map((registration, index) => {
          if (!registration?.item && !registration?.components?.Item) {
            return null;
          }

          return (
            <div
              className={cssNames(styles.item, {
                [styles.onLeft]: registration.components?.position == "left",
                [styles.onRight]: registration.components?.position != "left",
              })}
              key={index}
            >
              {this.renderRegisteredItem(registration)}
            </div>
          );
        })}
      </>
    );
  }

  render() {
    return (
      <div className={styles.BottomBar}>
        {this.renderRegisteredItems()}
      </div>
    );
  }
}
