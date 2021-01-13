import "./menu-actions.scss";

import React, { isValidElement } from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { autobind, cssNames } from "../../utils";
import { ConfirmDialog } from "../confirm-dialog";
import { Icon, IconProps } from "../icon";
import { Menu, MenuItem, MenuProps } from "../menu";
import uniqueId from "lodash/uniqueId";
import isString from "lodash/isString";

export interface MenuActionsProps extends Partial<MenuProps> {
  className?: string;
  toolbar?: boolean; // display menu as toolbar with icons
  autoCloseOnSelect?: boolean;
  triggerIcon?: string | IconProps | React.ReactNode;
  removeConfirmationMessage?: React.ReactNode | (() => React.ReactNode);
  updateAction?(): void;
  removeAction?(): void;
}

@observer
export class MenuActions extends React.Component<MenuActionsProps> {
  static defaultProps: MenuActionsProps = {
    get removeConfirmationMessage() {
      return `Remove item?`;
    }
  };

  public id = uniqueId("menu_actions_");

  @observable isOpen = !!this.props.toolbar;

  toggle = () => {
    if (this.props.toolbar) return;
    this.isOpen = !this.isOpen;
  };

  @autobind()
  remove() {
    const { removeAction } = this.props;
    let { removeConfirmationMessage } = this.props;

    if (typeof removeConfirmationMessage === "function") {
      removeConfirmationMessage = removeConfirmationMessage();
    }
    ConfirmDialog.open({
      ok: removeAction,
      labelOk: `Remove`,
      message: <div>{removeConfirmationMessage}</div>,
    });
  }

  renderTriggerIcon() {
    if (this.props.toolbar) return;
    const { triggerIcon = "more_vert" } = this.props;
    let className: string;

    if (isValidElement<HTMLElement>(triggerIcon)) {
      className = cssNames(triggerIcon.props.className, { active: this.isOpen });

      return React.cloneElement(triggerIcon, { id: this.id, className } as any);
    }
    const iconProps: Partial<IconProps> = {
      id: this.id,
      interactive: true,
      material: isString(triggerIcon) ? triggerIcon : undefined,
      active: this.isOpen,
      ...(typeof triggerIcon === "object" ? triggerIcon : {}),
    };

    if (iconProps.tooltip && this.isOpen) {
      delete iconProps.tooltip; // don't show tooltip for icon when menu is open
    }

    return (
      <Icon {...iconProps}/>
    );
  }

  render() {
    const {
      className, toolbar, autoCloseOnSelect, children, updateAction, removeAction, triggerIcon, removeConfirmationMessage,
      ...menuProps
    } = this.props;
    const menuClassName = cssNames("MenuActions flex", className, {
      toolbar,
      gaps: toolbar, // add spacing for .flex
    });
    const autoClose = !toolbar;

    return (
      <>
        {this.renderTriggerIcon()}
        <Menu
          htmlFor={this.id}
          isOpen={this.isOpen} open={this.toggle} close={this.toggle}
          className={menuClassName}
          usePortal={autoClose}
          closeOnScroll={autoClose}
          closeOnClickItem={autoCloseOnSelect ?? autoClose }
          closeOnClickOutside={autoClose}
          {...menuProps}
        >
          {children}
          {updateAction && (
            <MenuItem onClick={updateAction}>
              <Icon material="edit" interactive={toolbar} title={`Edit`}/>
              <span className="title">Edit</span>
            </MenuItem>
          )}
          {removeAction && (
            <MenuItem onClick={this.remove}>
              <Icon material="delete" interactive={toolbar} title={`Delete`}/>
              <span className="title">Remove</span>
            </MenuItem>
          )}
        </Menu>
      </>
    );
  }
}
