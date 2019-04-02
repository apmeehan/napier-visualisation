# Napier University Visualisation

Connections between Napier University research staff, by paper co-authorships.

Written in JavaScript, using the D3.js visualisation library.

[Viewable here.](https://apmeehan.github.io/napier-visualisation/)

The data is loaded on runtime from a single JSON file, which specifies which
papers and grants are associated with each staff member, in the following format:
~~~~
{
  "people": {
    "41": {
      "name": "Jessie Kennedy",
      "centre": "CISS",
      "publications": [
        "286105",
        "286263",
        "286267",
        "286277"
      ],
      "grants": [
        "13355681",
        "13355659",
        "13364427"
      ]
    },
~~~~
And the tool does the rest.

## Background

The aim of any information visualisation tool is to illuminate and inform, by presenting a mass of data in such a way as it can be quickly and intuitively processed by a person without too much cognitive effort. It will also allow one to gain insight, by interactive exploration, into trends in the data, or to uncover previously hidden patterns.

There are many research staff based at Edinburgh Napier University. Records of these staff, past and present, are kept, with details of their published papers, their grants, and the which research groups they belong to. One might wish to:
* Explore this data, and to discover the connections between different members of staff, through joint journal publications, or through shared grants.
* Discover how often members of research groups collaborate with others members of different research groups, or whether some groups tend to collaborate on papers more than others.
* See how many publications a specific pair of staff members have worked on together, and what those publications were.

This tool was part of a project to highlight the benefits of interactive information visualisation, for exploring and communicating data such as this.
