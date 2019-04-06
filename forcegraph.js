function forceGraph(nodeDataKey, linkDataKey, nodeColourKey) {
	var e, // iterator variable
		nodes = [],
		links = [],
		force,
		node,
		link,
		w = document.getElementById("chart1").clientWidth;
		h = 480,
		fill = d3.scale.category10(),
		currentZoom = 1,
		currentPan = [0, 0];


	// TODO: generalise later by deriving this
	var nodeKeys = {
		"people": ["centre", "publications", "grants"],
		"publications": ["type", "people", "grants"],
		"grants": ["funding_subtype", "people", "publications"]
	}
	var data;


	var	radiusScales = [
			{name: "Constant", scale: function () { return 5; }},
			{name: "Logarithmic", scale: function (d) { return Math.pow(d.staffInfo[linkDataKey].length, 0.4) + 4; }},
			{name: "Linear", scale: function (d) { return 2 * Math.pow(d.staffInfo[linkDataKey].length + 2, 0.5); }}
		],
		currentRadiusScaleIndex = 1;

	var	widthScales = [
			{name: "Constant", scale: function () { return 1; }},
			{name: "Logarithmic", scale: function (d) { return Math.pow(d.cnt, 0.7); }},
			{name: "Linear", scale: function (d) { return d.cnt; }}
		],
		currentWidthScaleIndex = 1;

	var	forceScales = [
			{name: "Constant", scale: function () { return 1; }},
			{name: "Logarithmic", scale: function (d) { return d.cnt / 60; }},
		],
		currentForceScaleIndex = 0;

	var charges = [-200, -80],
		linkDistances = [40, 0];


	var force = d3.layout.force()
		.size([w, h])
		.gravity(0.1)
		.charge(charges[currentForceScaleIndex])
		.linkDistance(linkDistances[currentForceScaleIndex])
		.linkStrength(forceScales[currentForceScaleIndex].scale)

	var chart = d3.select("#chart1");

	// remove previous chart
	chart.selectAll("*").remove();

	// create actual svg visualisation
	var svg = chart.append("svg:svg")
			.attr("width", w)
			.attr("height", h)
			.call(d3.behavior.zoom().on("zoom", redrawIt))

	svg.append("svg:rect")
			.attr("width", w)
			.attr("height", h)
			.attr("fill", "white");

	var vis = svg.append("svg:g");

	// add control buttons
	chart.append("xhtml:button")
		.text("Change node-size scaling")
		.on("click", cycleRadiusScale);
	chart.append("xhtml:button")
		.text("Change link-width scaling")
		.on("click", cycleWidthScale);

	// fade in vis
	// note: very small values, when stringified, may be converted to scientific notation and cause
	// a temporarily invalid attribute or style property. so rather than starting or ending transitions with 0,
	// use 1e-6, which is the smallest value that is not stringified in exponential notation
	vis.style("opacity", 1e-6)
		.transition()
			.duration(2000)
			.style("opacity", 1);


	d3.json("data.json", function (json) {
		data = json;

		for (e in data[nodeDataKey])
			if (data[nodeDataKey][e][linkDataKey].length > 0)
				nodes.push({ "staffID": e, "staffInfo": data[nodeDataKey][e] });

		var i, j, k, isLink;
		var pubs = data[linkDataKey];
		for (e in pubs)
			if (pubs[e][nodeDataKey].length > 1)
				for (i = 0; i < pubs[e][nodeDataKey].length; i++)
					for (j = i + 1; j < pubs[e][nodeDataKey].length; j++)
						addNewLinks(links, pubs[e][nodeDataKey][i], pubs[e][nodeDataKey][j]);

		console.log("number of nodes: " + nodes.length + "\nnumber of links: " + links.length);
		visualiseIt();
	});

	function getNodeIndex(nodeArray, staffID) {
		var i;

		// if array contains a node with desired staffID, return its index
		for (i = 0; i < nodeArray.length; i++)
			if (nodeArray[i].staffID === staffID)
				return i;

		// otherwise...
		return -1;
	}

	function addNewLinks(linkArray, newSourceID, newTargetID) {
		var e,
			i = getNodeIndex(nodes, newSourceID),
			j = getNodeIndex(nodes, newTargetID),
			isNewLink = true;

		//if (i === -1) console.log(newSourceID);
		//if (j === -1) console.log(newTargetID);

		if ((i !== -1) && (j !== -1)) {
			for (e in linkArray) {
				if (
					(linkArray[e].source === i && linkArray[e].target === j) ||
					(linkArray[e].source === j && linkArray[e].target === i)
				) {
					isNewLink = false;
					linkArray[e].cnt++;
					break;
				}
			}

			if (isNewLink) linkArray.push({ "source": i, "target": j, "cnt": 1 });
		}
	}

	function visualiseIt() {
		var selectedNodeIndices = [];

		force
			.nodes(nodes)
			.links(links)
			.on("tick", tick)
			.start();

		link = vis.selectAll("line.link")
				.data(links)
			.enter().append("svg:line")
				.attr("class", "link")
				.style("stroke-width", function (d) { return widthScales[currentWidthScaleIndex].scale(d) / currentZoom; })
				.style("opacity", 0.6)
				.attr("x1", function (d) { return d.source.x; })
				.attr("y1", function (d) { return d.source.y; })
				.attr("x2", function (d) { return d.target.x; })
				.attr("y2", function (d) { return d.target.y; })
				.on("mouseover", function (d) {
					vis.selectAll(".linktext .key").text("Shared " + linkDataKey + ": ");
					vis.selectAll(".linktext .value").text(d.cnt);

					// opacity transition needs to apply to container as text may already be in middle of
					// transform transition (sliding left/right), and an element can only have one active transition
					vis.selectAll(".linktextcontainer")
						.transition()
							.duration(0)
							.style("opacity", 1);

					d3.select(this)
						.transition()
							.duration(0)
							.style("opacity", 1);
				})
				.on("mouseout", function () {
					vis.selectAll(".linktextcontainer")
						.transition()
							.duration(1000)
							.style("opacity", 1e-6);

					d3.select(this)
						.transition()
							.duration(250)
							.style("opacity", 0.6);
				})
				.on("click", function (d) {
					// remove any existing node circle outlines
					d3.selectAll(".selectedNodeOutline").remove();

					// check if clicked link's two corresponding nodes (source and target) are already selected.
					// if not, then define as new selected node pair and update graph accordingly. if they are then deselect
					if (
						!(selectedNodeIndices[0] === d.source.index && selectedNodeIndices[1] === d.target.index) &&
						!(selectedNodeIndices[1] === d.source.index && selectedNodeIndices[0] === d.target.index)
					) {
						selectedNodeIndices = [d.source.index, d.target.index];
						console.log("indices of selected nodes: " + selectedNodeIndices);

						// create a subselection with only the two nodes associated with the chosen link
						var selectedNodes = node.filter(function (d2) { return (d2 === d.source) || (d2 === d.target); });

						// add a larger circle behind selected nodes' circles, for outline effect
						var selectedNodeRadii = [];
						selectedNodes.select(".circle")
							.each(function () { selectedNodeRadii.push(+d3.select(this).attr("r")); });
						selectedNodes
							.insert("svg:g", ".circle")
								.attr("class", "selectedNodeOutline")
							.append("svg:circle")
								.attr("class", "circle")
								.attr("transform", "scale(" + (1 / currentZoom) + ")")
								.attr("r", function (d, i) { return selectedNodeRadii[i] + 3 })
								.style("fill", function (d) { return fill(d.staffInfo[nodeColourKey]); });

						// create a subselection with only the links whose source or target matches either selected node
						var selectedLinks = link.filter(function (d2) {
							return (d2.source === d.source)
								|| (d2.source === d.target)
								|| (d2.target === d.source)
								|| (d2.target === d.target);
						});

						// fade out all links that arent in subselection, and prevent mouse interaction
						link.style("pointer-events", "none")
							.transition()
								.duration(500)
								.style("opacity", 1e-6);
						selectedLinks.style("pointer-events", "auto")
							.transition()
								.duration(500)
								.style("opacity", 0.6);

						// as clicked link will be highlighted (because of mouseover), make sure it remains so
						d3.select(this)
							.transition()
								.duration(0)
								.style("opacity", 1);

						// highlight selected pair of nodes' neighbouring nodes
						node.selectAll(".circle").transition()
							.duration(500)
							.style("opacity", 0.2);

						var sourcesAndTargets = [];
						selectedLinks.each(function (d) {
								sourcesAndTargets.push(d.source);
								sourcesAndTargets.push(d.target);
						});
						var selectedNodeNeighbours = node.filter(function (d) { return sourcesAndTargets.indexOf(d) !== -1; });
						selectedNodeNeighbours.selectAll(".circle").transition()
							.duration(500)
							.style("opacity", 1);

						// in case node's info panel is already visible, slide it right out of sight
						infopanel_node.transition()
							.duration(500)
							.style("opacity", 1e-6)
							.attr("transform", "translate(150,0)");

						// update link's info panel and slide left into sight
						infopanel_link.select(".heading1")
								.text(d.source.staffInfo.label)
							.append("svg:title") // gets overwritten next time text property is set
								.text();

						infopanel_link.select(".heading2")
								.text(d.target.staffInfo.label)
							.append("svg:title") // gets overwritten next time text property is set
								.text();

						infopanel_link.select(".infovalue1")
								.text(d.cnt)
							.append("svg:title")
								.text("[List of co-authored publications]");

						infopanel_link.transition()
							.duration(500)
							.style("opacity", 1)
							.attr("transform", "translate(0,0)");

						// slide linktext left so as not to be obscured by info panel
						vis.selectAll(".linktext")
							.transition()
								.duration(500)
								.attr("transform", "translate(-150,0)");
					}
					else {
						node.selectAll(".circle")
							.transition()
								.duration(500)
								.style("opacity", 1);

						link.style("pointer-events", "auto")
							.transition()
								.duration(500)
								.style("opacity", 0.6);

						// as clicked link will be highlighted (because of mouseover), make sure it remains so
						d3.select(this)
							.transition()
								.duration(0)
								.style("opacity", 1);

						// slide link's info panel right out of sight again
						infopanel_link.transition()
							.duration(500)
							.style("opacity", 1e-6)
							.attr("transform", "translate(150,0)");

						// slide linktext right again
						vis.selectAll(".linktext")
							.transition()
								.duration(500)
								.attr("transform", "translate(0,0)");

						selectedNodeIndices.length = 0;
						console.log("indices of selected nodes: " + selectedNodeIndices);
					}
				});

		node = vis.selectAll("g.node")
				.data(nodes)
			.enter().append("svg:g")
				.attr("class", "node")
				.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
				.on("mouseover", function () {
					d3.select(this).selectAll(".nodetext")
						.style("display", "block")
						.transition()
							.duration(0)
							.style("opacity", 1);

					d3.select(this).selectAll(".circle")
						.transition()
							.duration(0)
							.style("fill", function (d) { return d3.rgb(fill(d.staffInfo[nodeColourKey])).brighter(); });
				})
				.on("mouseout", function () {
					d3.select(this).selectAll(".nodetext")
						.transition()
							.duration(1000)
							.style("opacity", 1e-6)
							.each("end", function () {
								d3.select(this)
									.style("display", "none");
							});

					d3.select(this).selectAll(".circle")
						.transition()
							.duration(1000)
							.style("fill", function (d) { return fill(d.staffInfo[nodeColourKey]); });
				})
				.on("click", function (d) {
					force.stop();

					// remove any existing node circle outlines
					d3.selectAll(".selectedNodeOutline").remove();

					// check if clicked node is already selected.
					// if not, then define as new selected node and update graph accordingly. if it is then deselect
					if (selectedNodeIndices.length !== 1 || selectedNodeIndices[0] !== d.index) {
						selectedNodeIndices.length = 1;
						selectedNodeIndices[0] = d.index;
						console.log("indices of selected nodes: " + selectedNodeIndices);

						// add a larger circle behind selected circle, for outline effect
						var selectedNodeRadius = +d3.select(this).select(".circle").attr("r");
						d3.select(this)
							.insert("svg:g", ".circle")
								.attr("class", "selectedNodeOutline")
							.append("svg:circle")
								.attr("class", "circle")
								.attr("transform", "scale(" + (1 / currentZoom) + ")")
								.attr("r", selectedNodeRadius + 3)
								.style("fill", function (d) { return d3.rgb(fill(d.staffInfo[nodeColourKey])).brighter(); });

						// create a subselection with only the links whose source or target matches selected node
						var selectedLinks = link.filter(function (d2) { return (d2.source === d) || (d2.target === d); });

						// fade out all links that arent in subselection, and prevent mouse interaction
						link.style("pointer-events", "none")
							.transition()
								.duration(500)
								.style("opacity", 1e-6);
						selectedLinks.style("pointer-events", "auto")
							.transition()
								.duration(500)
								.style("opacity", 0.6);

						// highlight selected node's neighbouring nodes
						node.selectAll(".circle").transition()
							.duration(500)
							.style("opacity", 0.2);

						var sourcesAndTargets = [];
						selectedLinks.each(function (d) {
								sourcesAndTargets.push(d.source);
								sourcesAndTargets.push(d.target);
						});
						var selectedNodeNeighbours = node.filter(function (d) { return sourcesAndTargets.indexOf(d) !== -1; });
						selectedNodeNeighbours.selectAll(".circle").transition()
							.duration(500)
							.style("opacity", 1);

						// make sure clicked node remains highlighted even if it has no neighbours
						d3.select(this).selectAll(".circle").transition()
							.duration(0)
							.style("opacity", 1);

						// in case link's info panel is already visible, slide it right out of sight
						infopanel_link.transition()
							.duration(500)
							.style("opacity", 1e-6)
							.attr("transform", "translate(150,0)");

						// update node's info panel and slide left into sight
						infopanel_node.select(".heading")
								.text(d.staffInfo.label)
							.append("svg:title") // gets overwritten next time text property is set
								.text(d.staffInfo.label);

						infopanel_node.select(".infovalue1")
								.text(d.staffInfo[nodeKeys[nodeDataKey][0]])
							.append("svg:title")
								.text(d.staffInfo[nodeKeys[nodeDataKey][0]]);

						infopanel_node.select(".infovalue2")
								.text(d.staffInfo[nodeKeys[nodeDataKey][1]].length)
							.append("svg:title")
								.text(function () {
									var arr = d.staffInfo[nodeKeys[nodeDataKey][1]];
									var str = "", i;
									for (i = 0; i < arr.length; i++)
										str += data[nodeKeys[nodeDataKey][1]][arr[i]].label + "\n";
									return str;
								});

						infopanel_node.select(".infovalue3")
								.text(d.staffInfo[nodeKeys[nodeDataKey][2]].length)
							.append("svg:title")
							.text(function () {
								var arr = d.staffInfo[nodeKeys[nodeDataKey][2]];
								var str = "", i;
								for (i = 0; i < arr.length; i++)
									str += data[nodeKeys[nodeDataKey][2]][arr[i]].label + "\n";
								return str;
							});

						infopanel_node.transition()
							.duration(500)
							.style("opacity", 1)
							.attr("transform", "translate(0,0)");

						// slide linktext left so as not to be obscured by info panel
						vis.selectAll(".linktext")
							.transition()
								.duration(500)
								.attr("transform", "translate(-150,0)");
					}
					else {
						node.selectAll(".circle")
							.transition()
								.duration(500)
								.style("opacity", 1);

						link.style("pointer-events", "auto")
							.transition()
								.duration(500)
								.style("opacity", 0.6);

						// slide nodes's info panel right out of sight again
						infopanel_node.transition()
							.duration(500)
							.style("opacity", 1e-6)
							.attr("transform", "translate(150,0)");

						// slide linktext right again
						vis.selectAll(".linktext")
							.transition()
								.duration(500)
								.attr("transform", "translate(0,0)");

						selectedNodeIndices.length = 0;
						console.log("indices of selected nodes: " + selectedNodeIndices);
					}
				})
				.call(force.drag);



		// draw circles
		node.append("svg:circle")
			.attr("class", "circle")
			.attr("r", radiusScales[currentRadiusScaleIndex].scale)
			.style("fill", function (d) { return fill(d.staffInfo[nodeColourKey]); });

		// draw nodes' mouse-over text
		// (text is drawn twice, to give it a white outline - more legible)
		node.append("svg:text")
			.attr("class", "nodetext")
			.attr("x", radiusScales[currentRadiusScaleIndex].scale)
			.attr("dx", 4)
			.attr("y", ".4em")
			.style("display", "none")
			.style("opacity", 1e-6)
			.style("stroke-width", 3)
			.style("stroke", "#fff")
			.text(function (d) { return d.staffInfo.label; });
		node.append("svg:text")
			.attr("class", "nodetext")
			.attr("x", radiusScales[currentRadiusScaleIndex].scale)
			.attr("dx", 4)
			.attr("y", ".4em")
			.style("display", "none")
			.style("opacity", 1e-6)
			.text(function (d) { return d.staffInfo.label; });

		// add text element for displaying links' mouse-over text
		// (text is drawn twice, to give it a white outline - more legible)
		var linktextcontainer = vis.append("svg:g")
				.attr("class", "linktextcontainer")
				.style("opacity", 1e-6);
		linktextcontainer.append("svg:text")
				.attr("class", "linktext")
				.attr("transform", "translate(0,0)") // seems unnecessary, but need to set initial state for transition
				.attr("x", w - 139)
				.attr("y", 25)
				.style("stroke-width", 3)
				.style("stroke", "#fff")
			.selectAll().data(["key", "value"]).enter()
			.append("svg:tspan")
				.attr("class", function (d) { return d; });
		linktextcontainer.append("svg:text")
				.attr("class", "linktext")
				.attr("transform", "translate(0,0)")
				.attr("x", w - 139)
				.attr("y", 25)
			.selectAll().data(["key", "value"]).enter()
			.append("svg:tspan")
				.attr("class", function (d) { return d; });



		// add text element for displaying info when user changes vis settings
		// (text is drawn twice, to give it a white outline - more legible)
		vis.append("svg:text")
				.attr("class", "settinginfo")
				.attr("x", 15)
				.attr("y", 25)
				.style("stroke-width", 3)
				.style("stroke", "#fff");
		vis.append("svg:text")
				.attr("class", "settinginfo")
				.attr("x", 15)
				.attr("y", 25);



		// add text element for displaying staff info when user selects a node
		var leftcol, rightcol;
		var infopanel_node = vis.append("svg:g")
				.attr("class", "infopanelcontainer")
				.attr("transform", "scale(" + (1 / currentZoom)
					+ ") translate(" + (w - 139 - currentPan[0]) + "," + (25 - currentPan[1]) + ")")
			.append("svg:g")
				.attr("class", "infopanel")
				.attr("transform", "translate(150,0)")
				.style("opacity", 1e-6);

		infopanel_node.append("svg:rect")
				.attr("class", "panelbg")
				.attr("x", -8.5)
				.attr("y", -18.5)
				.attr("width", 140)
				.attr("height", 12 * 7 + 18)
				.style("fill", "#ffe")
				.style("stroke", "#bbb");

		infopanel_node.append("svg:line")
				.attr("class", "panelbg")
				.attr("x1", -8)
				.attr("y1", 7.5)
				.attr("x2", 132)
				.attr("y2", 7.5)
				.style("stroke", "#bbb");

		infopanel_node.append("svg:text")
				.attr("class", "heading")
				.attr("x", 0)
				.attr("y", 0)
			.append("svg:title")
				.text("test");

		leftcol = infopanel_node.append("svg:text")
				.attr("class", "leftcol");

		leftcol.append("svg:tspan")
				.attr("class", "infokey1")
				.text(nodeKeys[nodeDataKey][0])
				.attr("x", 0)
				.attr("dy", 12 * 2);

		leftcol.append("svg:tspan")
				.attr("class", "infokey2")
				.text(nodeKeys[nodeDataKey][1])
				.attr("x", 0)
				.attr("dy", 12 * 2);

		leftcol.append("svg:tspan")
				.attr("class", "infokey3")
				.text(nodeKeys[nodeDataKey][2])
				.attr("x", 0)
				.attr("dy", 12 * 2);

		rightcol = infopanel_node.append("svg:text")
				.attr("class", "rightcol");

		rightcol.append("svg:tspan")
				.attr("class", "infovalue1")
				.attr("x", 90)
				.attr("dy", 12 * 2);

		rightcol.append("svg:tspan")
				.attr("class", "infovalue2")
				.attr("x", 90)
				.attr("dy", 12 * 2);

		rightcol.append("svg:tspan")
				.attr("class", "infovalue3")
				.attr("x", 90)
				.attr("dy", 12 * 2);

		// add text element for displaying joint staff info when user selects a link
		var infopanel_link = vis.append("svg:g")
				.attr("class", "infopanelcontainer")
				.attr("transform", "scale(" + (1 / currentZoom)
					+ ") translate(" + (w - 139 - currentPan[0]) + "," + (25 - currentPan[1]) + ")")
			.append("svg:g")
				.attr("class", "infopanel")
				.attr("transform", "translate(150,0)")
				.style("opacity", 1e-6);

		infopanel_link.append("svg:rect")
				.attr("class", "panelbg")
				.attr("x", -8.5)
				.attr("y", -18.5)
				.attr("width", 140)
				.attr("height", 12 * 5 + 18)
				.style("fill", "#ffe")
				.style("stroke", "#bbb");

		infopanel_link.append("svg:line")
				.attr("class", "panelbg")
				.attr("x1", -8)
				.attr("y1", 7.5 + 24)
				.attr("x2", 132)
				.attr("y2", 7.5 + 24)
				.style("stroke", "#bbb");

		infopanel_link.append("svg:text")
				.attr("class", "heading1")
				.attr("x", 0)
				.attr("y", 0);

		infopanel_link.append("svg:text")
				.attr("class", "heading2")
				.attr("x", 0)
				.attr("y", 24 * 1);

		leftcol = infopanel_link.append("svg:text")
				.attr("class", "leftcol");

		leftcol.append("svg:tspan")
				.attr("class", "infokey1")
				.text(nodeKeys[nodeDataKey][1])
				.attr("x", 0)
				.attr("dy", 24 * 2);

		rightcol = infopanel_link.append("svg:text")
				.attr("class", "rightcol");

		rightcol.append("svg:tspan")
				.attr("class", "infovalue1")
				.attr("x", 90)
				.attr("dy", 24 * 2);
	}

	// updates node and link positions
	function tick() {
		link.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.y; });

		node.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
	}

	// for panning and zooming, whilst preserving circle sizes, line widths and text sizes
	function redrawIt() {
		currentZoom = d3.event.scale;
		currentPan = d3.event.translate;

		vis.attr("transform", "translate(" + currentPan + ") scale(" + currentZoom + ")");

		vis.selectAll(".settinginfo")
			.attr("transform", "scale(" + (1 / currentZoom)
				+ ") translate(" + (-currentPan[0]) + "," + (-currentPan[1]) + ")");

		vis.selectAll(".infopanelcontainer")
			.attr("transform", "scale(" + (1 / currentZoom)
				+ ") translate(" + (w - 139 - currentPan[0]) + "," + (25 - currentPan[1]) + ")")

		vis.selectAll(".circle")
			.attr("transform", "scale(" + (1 / currentZoom) + ")");

		vis.selectAll(".link")
			.style("stroke-width", function (d) { return widthScales[currentWidthScaleIndex].scale(d) / currentZoom; });

		vis.selectAll(".nodetext")
			.attr("transform", "scale(" + (1 / currentZoom) + ")");

		vis.selectAll(".linktextcontainer") // needs container because link text already has transform function
			.attr("transform", "scale(" + (1 / currentZoom)
				+ ") translate(" + (-currentPan[0]) + "," + (-currentPan[1]) + ")");
	}



	function showNewSettingInfo(text) {
		vis.selectAll(".settinginfo")
			.text(text)
			.style("opacity", 1)
			.transition()
				.duration(3000)
				.style("opacity", 1e-6);
	}

	function cycleRadiusScale() {
		currentRadiusScaleIndex = (currentRadiusScaleIndex + 1) % 3;

		node.selectAll(".circle").transition()
			.duration(500)
			.attr("r", radiusScales[currentRadiusScaleIndex].scale)

		node.selectAll(".nodetext")
			.attr("x", radiusScales[currentRadiusScaleIndex].scale)

		showNewSettingInfo(radiusScales[currentRadiusScaleIndex].name);
	}

	function cycleWidthScale() {
		currentWidthScaleIndex = (currentWidthScaleIndex + 1) % 3;

		vis.selectAll(".link").transition()
			.duration(500)
			.style("stroke-width", function (d) { return widthScales[currentWidthScaleIndex].scale(d) / currentZoom; })

		showNewSettingInfo(widthScales[currentWidthScaleIndex].name);
	}

	function cycleForceScale() {
		currentForceScaleIndex = (currentForceScaleIndex + 1) % 2;

		force
			.stop()
			.charge(charges[currentForceScaleIndex])
			.linkDistance(linkDistances[currentForceScaleIndex])
			.linkStrength(forceScales[currentForceScaleIndex].scale)
			.start();

		showNewSettingInfo(forceScales[currentForceScaleIndex].name);
	}
}
