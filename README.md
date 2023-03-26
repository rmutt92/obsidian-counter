# Obsidian - Counter

Counter is an Obsidian plugin that provides a simple counter of page views, edits, and words for metadata in YAML frontmatter.

## Features

- Automatic updating of YAML frontmatter metadata for selected events such as opening a file or making an edit
- Customizable settings such as enabling/disabling automatic updating, defining the metadata key, specifying the trigger event, creating new metadata, and turning on/off notifications
- Option to add custom counters with a specified count type such as counting up or down, adding the current date to a list, or counting words

## Installation

1. Open the settings pane in Obsidian
2. Click on "Community Plugins"
3. Search for "Counter" and click "Install" on the Counter plugin

## Usage

### Default Counters

Counter supports three default counters:

1. View Counter - Counts the number of times a file has been opened
2. Edit Date Logger - Records the date the file was last edited
3. Word Counter - Counts the total number of words in a page

### Custom Counters

Counter also supports to have custom counters. Count anything you want.

## Settings

This plugin has several settings that allow users to customize its behavior. These settings can be accessed by clicking on the "Counter" tab in the Obsidian settings panel.

## Usage

To use the Counter plugin, simply open any note and add the following YAML frontmatter:

```
---
views: 1
edits: [2023-03-26]
words: 0
---
```

Once the frontmatter is added, the plugin will automatically track the number of page views, edits, and words for that note. To view the count for a particular note, simply hover over the note in the file explorer and the count will be displayed in a tooltip.

## Contributing

The Counter plugin is open source and contributions are welcome. If you would like to contribute, please submit a pull request with your changes.


[☕️](https://www.buymeacoffee.com/rmutt1992m)
