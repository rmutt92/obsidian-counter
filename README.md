# Obsidian - Counter

Counter is a simple Obsidian plugin that provides a counter of page views, editing dates, and word counts for metadata in YAML frontmatter.

```
---
views: 8
edits: [2023-03-16, 2023-04-01]
words: 123
---
```

## Features

- Automatic updating of YAML front matter metadata for selected events, such as opening a file or making an edit. Hotkey command is supported.
- Customizable settings such as enabling/disabling automatic updating, name of the metadata key, specifying the trigger event, and turning on/off notifications.
- Option to add custom counters with a specified count type such as counting up or down, adding the current date to a list, or counting words of the page.

## Installation

1. Open the settings pane in Obsidian
2. Click on "Community Plugins"
3. Search for "Counter" and click "Install" on the Counter plugin

## Usage

### Default Counters

Counter supports three default counters:

1. **View Counter**: Counts the number of times a file has been opened.
2. **Edit Date Logger**: Records the dates the file was edited.
3. **Word Counter**: Counts the total number of words in a page.

### Custom Counters

Counter also supports to have custom counters. Count anything you want.

## Settings

- **Folders to Ignore**: You can set directories to prevent automatic updates.

## Usage

To use Counter, simply add those metadata key YAML frontmatter:
Of course, you can name those as you'd like.
```
---
views: 
edits: 
words: 
---
```

Make sure that you have added the same key as you configured in the settings panel of Counter.
Once the metadata key is added, the plugin is readly to automatically track the number of page views, edits, and words for that note. 

## Limitation
- Reading view is not supported.
- Nested key is not supported.
- Automatic creation of a metadata key in YAML frontmatter is not supported.

## Contribution

Counter is open source, and contributions are welcome. If you would like to contribute, please submit a pull request with your changes, or pitch me the wonderful idea. This plugin and the developper is fueled by [☕️](https://www.buymeacoffee.com/rmutt1992m)
