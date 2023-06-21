import { observer } from "mobx-react";
import * as React from "react";
import { Model } from "../model/Model";
import classnames = require("classnames");

@observer
export class GUI extends React.Component<{ model: Model }> {
	render() {
		const m = this.props.model;
		return (
			<div
				className="component-GUI"
				tabIndex={0}
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
				}}
			>
				
			</div>
		);
	}
}
