/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./add-dialog.scss";

import React from "react";
import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { NamespaceSelect } from "../../+namespaces/namespace-select";
import { Dialog, DialogProps } from "../../dialog";
import { Input } from "../../input";
import { showDetails } from "../../kube-detail-params";
import { SubTitle } from "../../layout/sub-title";
import { Notifications } from "../../notifications";
import { Wizard, WizardStep } from "../../wizard";
import { rolesStore } from "./store";

interface Props extends Partial<DialogProps> {
}

@observer
export class AddRoleDialog extends React.Component<Props> {
  static isOpen = observable.box(false);

  @observable roleName = "";
  @observable namespace = "";

  constructor(props: Props) {
    super(props);
    makeObservable(this);
  }

  static open() {
    AddRoleDialog.isOpen.set(true);
  }

  static close() {
    AddRoleDialog.isOpen.set(false);
  }

  reset = () => {
    this.roleName = "";
    this.namespace = "";
  };

  createRole = async () => {
    try {
      const role = await rolesStore.create({ name: this.roleName, namespace: this.namespace });

      showDetails(role.selfLink);
      this.reset();
      AddRoleDialog.close();
    } catch (err) {
      Notifications.error(err.toString());
    }
  };

  render() {
    const { ...dialogProps } = this.props;
    const header = <h5>Create Role</h5>;

    return (
      <Dialog
        {...dialogProps}
        className="AddRoleDialog"
        isOpen={AddRoleDialog.isOpen.get()}
        close={AddRoleDialog.close}
      >
        <Wizard header={header} done={AddRoleDialog.close}>
          <WizardStep
            contentClass="flex gaps column"
            nextLabel="Create"
            next={this.createRole}
          >
            <SubTitle title="Role Name" />
            <Input
              required autoFocus
              placeholder="Name"
              iconLeft="supervisor_account"
              value={this.roleName}
              onChange={v => this.roleName = v}
            />
            <SubTitle title="Namespace" />
            <NamespaceSelect
              themeName="light"
              value={this.namespace}
              onChange={({ value }) => this.namespace = value}
            />
          </WizardStep>
        </Wizard>
      </Dialog>
    );
  }
}
