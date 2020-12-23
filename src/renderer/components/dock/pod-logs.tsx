import React from "react";
import { observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";

import { searchStore } from "../../../common/search-store";
import { autobind } from "../../utils";
import { IDockTab } from "./dock.store";
import { InfoPanel } from "./info-panel";
import { PodLogControls } from "./pod-log-controls";
import { PodLogList } from "./pod-log-list";
import { IPodLogsData, podLogsStore } from "./pod-logs.store";

interface Props {
  className?: string
  tab: IDockTab
}

@observer
export class PodLogs extends React.Component<Props> {
  @observable isLoading = true;

  private logListElement = React.createRef<PodLogList>(); // A reference for VirtualList component

  componentDidMount() {
    disposeOnUnmount(this,
      reaction(() => this.props.tab.id, this.reload, { fireImmediately: true })
    );
  }

  get tabData() {
    return podLogsStore.getData(this.tabId);
  }

  get tabId() {
    return this.props.tab.id;
  }

  @autobind()
  save(data: Partial<IPodLogsData>) {
    podLogsStore.setData(this.tabId, { ...this.tabData, ...data });
  }

  load = async () => {
    this.isLoading = true;
    await podLogsStore.load(this.tabId);
    this.isLoading = false;
  };

  reload = async () => {
    podLogsStore.clearLogs(this.tabId);
    await this.load();
  };

  /**
   * A function for various actions after search is happened
   * @param query {string} A text from search field
   */
  @autobind()
  onSearch() {
    this.toOverlay();
  }

  /**
   * Scrolling to active overlay (search word highlight)
   */
  @autobind()
  toOverlay() {
    const { activeOverlayLine } = searchStore;

    if (!this.logListElement.current || activeOverlayLine === undefined) return;
    // Scroll vertically
    this.logListElement.current.scrollToItem(activeOverlayLine, "center");
    // Scroll horizontally in timeout since virtual list need some time to prepare its contents
    setTimeout(() => {
      const overlay = document.querySelector(".PodLogs .list span.active");

      if (!overlay) return;
      overlay.scrollIntoViewIfNeeded();
    }, 100);
  }

  render() {
    const logs = podLogsStore.logs;

    const controls = (
      <PodLogControls
        ready={!this.isLoading}
        tabId={this.tabId}
        tabData={this.tabData}
        logs={logs}
        save={this.save}
        reload={this.reload}
        onSearch={this.onSearch}
        toPrevOverlay={this.toOverlay}
        toNextOverlay={this.toOverlay}
      />
    );

    return (
      <div className="PodLogs flex column">
        <InfoPanel
          tabId={this.props.tab.id}
          controls={controls}
          showSubmitClose={false}
          showButtons={false}
          showStatusPanel={false}
        />
        <PodLogList
          logs={logs}
          id={this.tabId}
          isLoading={this.isLoading}
          load={this.load}
          ref={this.logListElement}
        />
      </div>
    );
  }
}
