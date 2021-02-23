import "./error-boundary.scss";

import React, { ErrorInfo } from "react";
import { reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import { Button } from "../button";
import { navigation } from "../../navigation";
import { issuesTrackerUrl, slackUrl } from "../../../common/vars";

interface Props {
}

interface State {
  error?: Error;
  errorInfo?: ErrorInfo;
}

@observer
export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {};

  @disposeOnUnmount
  resetOnNavigate = reaction(
    () => navigation.getPath(),
    () => this.setState({ error: null, errorInfo: null })
  );

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  back = () => {
    navigation.goBack();
  };

  render() {
    const { error, errorInfo } = this.state;

    if (error) {
      const slackLink = <a href={slackUrl} rel="noreferrer" target="_blank">Slack</a>;
      const githubLink = <a href={issuesTrackerUrl} rel="noreferrer" target="_blank">Github</a>;
      const pageUrl = location.href;

      return (
        <div className="ErrorBoundary flex column gaps">
          <h5>
            App crash at <span className="contrast">{pageUrl}</span>
          </h5>
          <p>
            To help us improve the product please report bugs to {slackLink} community or {githubLink} issues tracker.
          </p>
          <div className="wrapper">
            <code className="block">
              <p className="contrast">Component stack:</p>
              {errorInfo.componentStack}
            </code>
            <code className="box grow">
              <p className="contrast">Error stack:</p> <br/>
              {error.stack}
            </code>
          </div>
          <Button
            className="box self-flex-start"
            primary label="Back"
            onClick={this.back}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
