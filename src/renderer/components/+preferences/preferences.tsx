import "./preferences.scss";

import React from "react";
import moment from "moment-timezone";
import { computed, observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";

import { isWindows } from "../../../common/vars";
import { appPreferenceRegistry, RegisteredAppPreference } from "../../../extensions/registries/app-preference-registry";
import { UserStore } from "../../../common/user-store";
import { ThemeStore } from "../../theme.store";
import { Input } from "../input";
import { PageLayout } from "../layout/page-layout";
import { SubTitle } from "../layout/sub-title";
import { Select, SelectOption } from "../select";
import { HelmCharts } from "./helm-charts";
import { KubectlBinaries } from "./kubectl-binaries";
import { navigation } from "../../navigation";
import { Tab, Tabs } from "../tabs";
import { FormSwitch, Switcher } from "../switch";

enum Pages {
  Application = "application",
  Proxy = "proxy",
  Kubernetes = "kubernetes",
  Telemetry = "telemetry",
  Extensions = "extensions",
  Other = "other"
}

@observer
export class Preferences extends React.Component {
  @observable httpProxy = UserStore.getInstance().preferences.httpsProxy || "";
  @observable shell = UserStore.getInstance().preferences.shell || "";
  @observable activeTab = Pages.Application;

  @computed get themeOptions(): SelectOption<string>[] {
    return ThemeStore.getInstance().themes.map(theme => ({
      label: theme.name,
      value: theme.id,
    }));
  }

  timezoneOptions: SelectOption<string>[] = moment.tz.names().map(zone => ({
    label: zone,
    value: zone,
  }));

  componentDidMount() {
    disposeOnUnmount(this, [
      reaction(() => navigation.location.hash, hash => {
        const fragment = hash.slice(1); // hash is /^(#\w.)?$/

        if (fragment) {
          // ignore empty framents
          document.getElementById(fragment)?.scrollIntoView();
        }
      }, {
        fireImmediately: true
      })
    ]);
  }

  onTabChange = (tabId: Pages) => {
    this.activeTab = tabId;
  };

  renderNavigation() {
    const extensions = appPreferenceRegistry.getItems().filter(e => !e.showInPreferencesTab);

    return (
      <Tabs className="flex column" scrollable={false} onChange={this.onTabChange} value={this.activeTab}>
        <div className="header">Preferences</div>
        <Tab value={Pages.Application} label="Application" data-testid="application-tab"/>
        <Tab value={Pages.Proxy} label="Proxy" data-testid="proxy-tab"/>
        <Tab value={Pages.Kubernetes} label="Kubernetes" data-testid="kube-tab"/>
        <Tab value={Pages.Telemetry} label="Telemetry" data-testid="telemetry-tab"/>
        {extensions.length > 0 &&
          <Tab value={Pages.Extensions} label="Extensions" data-testid="extensions-tab"/>
        }
      </Tabs>
    );
  }

  renderExtension({ title, id, components: { Hint, Input } }: RegisteredAppPreference) {
    return (
      <React.Fragment key={id}>
        <section id={id} className="small">
          <SubTitle title={title}/>
          <Input/>
          <div className="hint">
            <Hint/>
          </div>
        </section>
        <hr className="small"/>
      </React.Fragment>
    );
  }

  render() {
    const extensions = appPreferenceRegistry.getItems();
    const telemetryExtensions = extensions.filter(e => e.showInPreferencesTab == Pages.Telemetry);
    const { preferences } = UserStore.getInstance();
    const defaultShell = process.env.SHELL
      || process.env.PTYSHELL
      || (
        isWindows
          ? "powershell.exe"
          : "System default shell"
      );

    return (
      <PageLayout
        showOnTop
        navigation={this.renderNavigation()}
        className="Preferences"
        contentGaps={false}
      >
        {this.activeTab == Pages.Application && (
          <section id="application">
            <h2 data-testid="application-header">Application</h2>
            <section id="appearance">
              <SubTitle title="Theme"/>
              <Select
                options={this.themeOptions}
                value={preferences.colorTheme}
                onChange={({ value }: SelectOption) => preferences.colorTheme = value}
                themeName="lens"
              />
            </section>

            <hr/>

            <section id="shell">
              <SubTitle title="Terminal Shell Path"/>
              <Input
                theme="round-black"
                placeholder={defaultShell}
                value={this.shell}
                onChange={v => this.shell = v}
                onBlur={() => preferences.shell = this.shell}
              />
            </section>

            <hr/>

            <section id="other">
              <SubTitle title="Start-up"/>
              <FormSwitch
                control={
                  <Switcher
                    checked={preferences.openAtLogin}
                    onChange={v => preferences.openAtLogin = v.target.checked}
                    name="startup"
                  />
                }
                label="Automatically start Lens on login"
              />
            </section>

            <hr />

            <section id="locale">
              <SubTitle title="Locale Timezone" />
              <Select
                options={this.timezoneOptions}
                value={preferences.localeTimezone}
                onChange={({ value }: SelectOption) => UserStore.getInstance().setLocaleTimezone(value)}
                themeName="lens"
              />
            </section>
          </section>
        )}
        {this.activeTab == Pages.Proxy && (
          <section id="proxy">
            <section>
              <h2 data-testid="proxy-header">Proxy</h2>
              <SubTitle title="HTTP Proxy"/>
              <Input
                theme="round-black"
                placeholder="Type HTTP proxy url (example: http://proxy.acme.org:8080)"
                value={this.httpProxy}
                onChange={v => this.httpProxy = v}
                onBlur={() => preferences.httpsProxy = this.httpProxy}
              />
              <small className="hint">
                Proxy is used only for non-cluster communication.
              </small>
            </section>

            <hr className="small"/>

            <section className="small">
              <SubTitle title="Certificate Trust"/>
              <FormSwitch
                control={
                  <Switcher
                    checked={preferences.allowUntrustedCAs}
                    onChange={v => preferences.allowUntrustedCAs = v.target.checked}
                    name="startup"
                  />
                }
                label="Allow untrusted Certificate Authorities"
              />
              <small className="hint">
                This will make Lens to trust ANY certificate authority without any validations.{" "}
                Needed with some corporate proxies that do certificate re-writing.{" "}
                Does not affect cluster communications!
              </small>
            </section>
          </section>
        )}

        {this.activeTab == Pages.Kubernetes && (
          <section id="kubernetes">
            <section id="kubectl">
              <h2 data-testid="kubernetes-header">Kubernetes</h2>
              <KubectlBinaries preferences={preferences}/>
            </section>
            <hr/>
            <section id="helm">
              <h2>Helm Charts</h2>
              <HelmCharts/>
            </section>
          </section>
        )}

        {this.activeTab == Pages.Telemetry && (
          <section id="telemetry">
            <h2 data-testid="telemetry-header">Telemetry</h2>
            {telemetryExtensions.map(this.renderExtension)}
          </section>
        )}

        {this.activeTab == Pages.Extensions && (
          <section id="extensions">
            <h2>Extensions</h2>
            {extensions.filter(e => !e.showInPreferencesTab).map(this.renderExtension)}
          </section>
        )}
      </PageLayout>
    );
  }
}
