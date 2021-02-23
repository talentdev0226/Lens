import "./create-service-account-dialog.scss";

import React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { Dialog, DialogProps } from "../dialog";
import { Wizard, WizardStep } from "../wizard";
import { SubTitle } from "../layout/sub-title";
import { serviceAccountsStore } from "./service-accounts.store";
import { Input } from "../input";
import { systemName } from "../input/input_validators";
import { NamespaceSelect } from "../+namespaces/namespace-select";
import { Notifications } from "../notifications";
import { showDetails } from "../kube-object";

interface Props extends Partial<DialogProps> {
}

@observer
export class CreateServiceAccountDialog extends React.Component<Props> {
  @observable static isOpen = false;

  @observable name = "";
  @observable namespace = "default";

  static open() {
    CreateServiceAccountDialog.isOpen = true;
  }

  static close() {
    CreateServiceAccountDialog.isOpen = false;
  }

  close = () => {
    CreateServiceAccountDialog.close();
  };

  createAccount = async () => {
    const { name, namespace } = this;

    try {
      const serviceAccount = await serviceAccountsStore.create({ namespace, name });

      this.name = "";
      showDetails(serviceAccount.selfLink);
      this.close();
    } catch (err) {
      Notifications.error(err);
    }
  };

  render() {
    const { ...dialogProps } = this.props;
    const { name, namespace } = this;
    const header = <h5>Create Service Account</h5>;

    return (
      <Dialog
        {...dialogProps}
        className="CreateServiceAccountDialog"
        isOpen={CreateServiceAccountDialog.isOpen}
        close={this.close}
      >
        <Wizard header={header} done={this.close}>
          <WizardStep nextLabel="Create" next={this.createAccount}>
            <SubTitle title="Account Name" />
            <Input
              autoFocus required
              placeholder="Enter a name"
              validators={systemName}
              value={name} onChange={v => this.name = v.toLowerCase()}
            />
            <SubTitle title="Namespace" />
            <NamespaceSelect
              themeName="light"
              value={namespace}
              onChange={({ value }) => this.namespace = value}
            />
          </WizardStep>
        </Wizard>
      </Dialog>
    );
  }
}
