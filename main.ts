import {
	App,
	Editor,
	MarkdownFileInfo,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	parseYaml,
} from "obsidian";

interface CounterMode {
	title: string;
	name: string;
	trigger: string;
	type: string;
	auto: boolean;
	create: boolean;
	notify: boolean;
}

interface CounterSettings {
	counterModeList: CounterMode[];
	customCounterModeList: CounterMode[];
	ignorePaths: string[];
}

const counterTriggerList = ["Open File", "Modify", "Command"];
const counterTypeList = [
	"count_up",
	"count_down",
	"add_date",
	"update_date",
	"word_count",
];

const DEFAULT_SETTINGS: CounterSettings = {
	counterModeList: [
		{
			title: "View Counter",
			name: "views",
			trigger: "Open File",
			type: "count_up",
			auto: true,
			create: false,
			notify: false,
		},
		{
			title: "Edit Date Logger",
			name: "edits",
			trigger: "Modify",
			type: "add_date",
			auto: true,
			create: false,
			notify: true,
		},
		{
			title: "Word Counter",
			name: "words",
			trigger: "Modify",
			type: "word_count",
			auto: true,
			create: false,
			notify: false,
		},
	],

	customCounterModeList: [
		{
			title: "",
			name: "ratings",
			trigger: "Command",
			type: "count_up",
			auto: false,
			create: false,
			notify: false,
		},
	],

	ignorePaths: [],
};

export default class Counter extends Plugin {
	settings: CounterSettings;

	private last_update = { name: "", file_path: "" };
	private last_update_time = new Date(0);

	async onload() {
		console.log("loading counter plugin");
		await this.loadSettings();

		// on
		// for (const key in counterTriggerList) {
		// 	const trigger = counterTriggerList[key];
		// 	this.app.workspace.on(trigger as "quit", async () => { this.updateCounter(trigger); })
		// }

		this.app.workspace.on("file-open", () => {
			this.updateCounter("Open File");
		});
		// this.app.workspace.on('active-leaf-change', () => { this.updateCounter('Active Leaf Change'); })
		this.registerEvent(
			this.app.vault.on("modify", () => {
				this.updateCounter("Modify");
			})
		);
		// this.registerEvent(this.app.vault.on('create', () => { this.updateCounter('Open File');}));

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CounterSettingTab(this.app, this));

		// This adds a simple command that can be triggered anywhere
		for (const key in this.settings.counterModeList) {
			const mode = this.settings.counterModeList[key];
			if (mode.trigger != "Command") continue;

			this.addCommand({
				id: mode.name,
				name: mode.title,
				callback: () => {
					this.updateCounterCommand(mode);
				},
			});
		}

		for (const key in this.settings.customCounterModeList) {
			const mode = this.settings.customCounterModeList[key];
			if (mode.trigger != "Command") continue;

			this.addCommand({
				id: mode.name,
				name: "Update | " + mode.name + ":",
				callback: () => {
					this.updateCounterCommand(mode);
				},
			});
		}
	}

	private async updateCounterCommand(mode: CounterMode) {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;

		await this.updateYamlFrontMatter(mode);
	}

	private async updateCounter(trigger: string) {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;

		// Check Ignore Folder
		for (const key in this.settings.ignorePaths) {
			const path = this.settings.ignorePaths[key];
			if (path && path != "" && file.path.indexOf(path) == 0) return;
		}

		// const update_time = new Date();
		// if (update_time.getTime() - this.last_update_time.getTime() < 100) return;

		const modes = this.findModes(trigger);

		for (const key in modes) {
			const mode = modes[key];
			if (!mode.auto) continue;

			this.updateYamlFrontMatter(mode);
		}
	}

	private findModes(trigger: string): CounterMode[] {
		const res = [];

		const allModes = [
			this.settings.counterModeList,
			this.settings.customCounterModeList,
		].flat();
		for (const key in allModes) {
			const mode = allModes[key];
			if (mode.trigger === trigger) {
				res.push(mode);
			}
		}

		return res;
	}

	private getEditor(): Editor | null {
		const activeLeaf: MarkdownFileInfo | null =
			this.app.workspace.activeEditor;
		if (!activeLeaf || !activeLeaf.editor) return null;

		return activeLeaf.editor;
	}

	private async updateYamlFrontMatter(mode: CounterMode): Promise<boolean> {
		const file = this.app.workspace.getActiveFile();
		if (!file) return false;

		const content = await this.app.vault.read(file);
		if (!content) return false;

		const metadata_name = mode.name;

		const frontMatterRegex = /---\n([\s\S]*?)\n---\n/;
		const yamlLines = content.match(frontMatterRegex);
		const firstLinePos = content.indexOf("---\n");

		if (!yamlLines) return false;

		const yaml = parseYaml(yamlLines[1]);
		const metadataExists = metadata_name in yaml;

		if (!metadataExists && !mode.create) {
			if (mode.trigger == "Command")
				new Notice(
					"Counter\n" + "Not Found Metadata key\n" + metadata_name
				);
			return false;
		}

		const yamlExists = yamlLines != null;
		if (!yamlExists && !mode.create) return false;

		const editor = this.getEditor();
		if (!editor) return false;

		const cursorPos = editor.getCursor("head");
		const lines = yamlLines ? yamlLines[1].split("\n") : [""];
		const yamlLinesLen = firstLinePos + lines.length + 2;

		if (cursorPos.line < yamlLinesLen) return false;

		function updateFrontmatter(new_value: string): boolean {
			const lines = yamlLines ? yamlLines[1].split("\n") : [""];

			if (metadataExists) {
				let line_pos = -1;
				// let line_end_pos = -1;

				for (let i = 0, size = lines.length; i < size; i++) {
					const line = lines[i];

					if (line.indexOf(metadata_name + ":") != 0) continue;

					line_pos = i;

					const rangeFrom = { line: line_pos + 1, ch: 0 };
					const rangeTo = { line: line_pos + 2, ch: 0 };

					const new_line = metadata_name + ": " + new_value + "\n";

					if (!editor) return false;

					editor.replaceRange(new_line, rangeFrom, rangeTo);
					return true;
				}
			}

			// else {
			// 	const insertPos = yamlLinesLen - 1;
			// 	const rangeFrom = { line: insertPos, ch: 0 };
			// 	const rangeTo = { line: insertPos + 1, ch: 0 };
			// 	// const rangeTo = next_metadata_found ? { line: line_end_pos+1, ch: 0} : { line: line_pos+2, ch: 0 };

			// 	// editor.replaceRange(metadata_name + ': ' + new_value, rangeFrom, rangeTo);d
			// 	const new_line = metadata_name + ': ' + new_value + '\n---\n';

			// 	// W.I.P It doesn't work properly
			// 	// if (editor) editor.replaceRange(new_line, rangeFrom, rangeTo);
			// }

			return false;
		}

		function arraysEqual(a: string[], b: string[]) {
			if (a.length !== b.length) return false;
			return a.every(
				(element, index) =>
					element === b[index] && index === b.indexOf(element)
			);
		}

		const current_value = yaml[metadata_name];

		let sucsess = false;

		switch (mode.type) {
			case "count_up":
			case "count_down":
				{
					if (current_value == null && !mode.auto) return false;

					const new_value =
						current_value != null
							? parseInt(current_value) +
							  (mode.type == "count_up" ? 1 : -1)
							: 1;

					sucsess = updateFrontmatter(new_value.toString());

					if (sucsess && mode.notify)
						new Notice("Counter\n" + metadata_name + ": +1");
				}
				break;

			case "add_date":
				{
					if (current_value == null && !mode.auto) return false;

					const currentDate = new Date().toISOString().split("T")[0];
					let current_arr = [currentDate];

					if (current_value != null) {
						current_arr = [current_value].flat();
						const current_dates = [
							...new Set(current_value),
						] as string[];
						current_dates.sort(
							(a: string, b: string) =>
								new Date(a).getTime() - new Date(b).getTime()
						);

						if (
							current_dates.includes(currentDate) &&
							arraysEqual(current_dates, current_arr)
						)
							return false;
					}

					let new_dates = [
						...new Set([current_value, currentDate].flat()),
					];
					new_dates.sort(
						(a, b) => new Date(a).getTime() - new Date(b).getTime()
					);

					new_dates = new_dates.filter(
						(item) => item !== undefined && item !== null
					) as string[];

					const new_value = "[" + new_dates.join(", ") + "]";
					sucsess = updateFrontmatter(new_value);

					if (sucsess && mode.notify)
						new Notice(
							"Counter\n" + metadata_name + ": +" + currentDate
						);
				}
				break;

			case "update_date":
				{
					if (current_value == null && !mode.auto) return false;

					const currentDate = new Date().toISOString().split("T")[0];

					if (current_value != null) {
						if (current_value == currentDate) return false;
					}

					sucsess = updateFrontmatter(currentDate);
					if (sucsess && mode.notify)
						new Notice(
							"Counter\n" + metadata_name + ": " + currentDate
						);
				}

				break;

			case "word_count":
				{
					if (current_value == null && !mode.auto) return false;

					const current_count =
						current_value != null ? parseInt(current_value) : 0;
					const new_value = this.countWords(
						content.substring(content.indexOf("\n---\n"))
					);

					if (current_count == new_value) return false;

					sucsess = updateFrontmatter(new_value.toString());

					if (sucsess && mode.notify)
						new Notice(
							"Counter\n" +
								metadata_name +
								": " +
								(current_count > 1
									? current_count + " -> "
									: "") +
								new_value
						);
				}
				break;

			default:
				return false;
		}

		return sucsess;
	}

	private countWords(text: string): number {
		const wordRegex = /['’\w]+/g; // matches any apostrophes or word characters
		const words = text.match(wordRegex); // extract all the words from the text using the regex
		return words ? words.length : 0; // return the number of words, or 0 if there are none
	}

	onunload() {
		// off
		// for (const key in counterTriggerList) {
		// 	const trigger = counterTriggerList[key];
		// 	this.app.workspace.off(trigger as "quit", async () => { this.updateCounter(trigger); })
		// }

		this.app.workspace.off("file-open", () => {
			this.updateCounter("Open File");
		});
		// this.app.workspace.off('active-leaf-change', () => { this.updateCounter('Active Leaf Change'); })
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CounterSettingTab extends PluginSettingTab {
	plugin: Counter;

	constructor(app: App, plugin: Counter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h1", { text: "Counter" });

		for (const key in this.plugin.settings.counterModeList) {
			const counter_mode = this.plugin.settings.counterModeList[key];
			this.addSettingPanel(containerEl, counter_mode, false);
			containerEl.createEl("br");
		}

		containerEl.createEl("br");
		containerEl.createEl("h1", { text: "Custom Counters" });

		for (const key in this.plugin.settings.customCounterModeList) {
			const counter_mode =
				this.plugin.settings.customCounterModeList[key];
			this.addSettingPanel(containerEl, counter_mode, true);
			containerEl.createEl("br");
		}

		this.addCustomCounter(containerEl);

		containerEl.createEl("br");
		containerEl.createEl("h1", { text: "Options" });
		containerEl.createEl("br");

		const ignoreFolders = this.plugin.settings.ignorePaths.join("\n");

		new Setting(containerEl)
			.setName("Folders to Ignore")
			.setDesc(
				"Files in these folders are ignored when the automatic counter update runs. Enter folder paths separated by new line."
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("Templates")
					.setValue(ignoreFolders)
					.onChange(async (value) => {
						this.plugin.settings.ignorePaths = value
							.split("\n")
							.filter((i) => i !== "" && i !== null);
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("br");
		containerEl.createEl("br");
		containerEl.createEl("h1", { text: "Notes" });
		containerEl.createEl("li", {
			text: "Please add the metadata key in YAML frontmatter manually.",
		});
		containerEl.createEl("li", {
			text: "Make sure that the metadata is NOT duplicated in the YAML front matter. It can gets buggy.",
		});
		containerEl.createEl("li", { text: "Reading view is not supported." });
		containerEl.createEl("li", { text: "Nested key is not supported." });
		containerEl
			.createEl("li", {
				text: "The developer of this plugin is obsessed with Obsidian and ",
			})
			.createEl("a", {
				text: "☕.",
				href: "https://www.buymeacoffee.com/rmutt1992m",
			});

		const greetings = [
			"Have a nice day!",
			"Have a nice counting!",
			"Hope you found this helpful!",
			"Wishing you a great day!",
			"Keep up the good work!",
			"Have a fantastic day!",
			"Take care and stay safe!",
			"Sending you good vibes!",
			"Best wishes to you!",
			"Good day!",
			"Thanks for your support!",
			"You're the best!",
			"May your day be filled with joy!",
			"Stay positive and have a great day!",
			"Sending positive energy your way!",
			"Have a blessed day!",
			"Wishing you a wonderful day!",
			"Have a beautiful day!",
			"Hope your day is as wonderful as you are!",
			"Keep smiling and have a great day!",
			"Enjoy every moment of your day!",
			"Have a marvelous day!",
			"May your day be full of happiness and peace!",
			"Hope your day is filled with smiles!",
			"Cheers to a wonderful day!",
			"May the Force be with you.",
			"Buy me a coffin!",
			// Spanish
			"¡Que tengas un buen día!",
			// French
			"Bonne journée !",
			// German
			"Einen schönen Tag noch!",
			// Portuguese
			"Tenha um bom dia!",
			// Russian
			"Хорошего дня!",
			// Chinese (Simplified)
			"祝你有个愉快的一天！",
			// Japanese
			"あざます！",
			"良いカウントを！",
			// Korean
			"좋은 하루 되세요!",
			// Hindi
			"अच्छा दिन हो!",
		];

		containerEl.createEl("li", {
			text: greetings[Math.floor(Math.random() * greetings.length)],
		});
	}

	private addSettingPanel(
		containerEl: HTMLElement,
		counter_mode: CounterMode,
		isCustom: boolean
	) {
		containerEl.createEl("br");
		containerEl.createEl("h2", {
			text: isCustom ? counter_mode.name + ":" : counter_mode.title,
		});

		// if (!counter_mode.auto) return;
		new Setting(containerEl)
			.setName("Enable")
			.setDesc(
				"Update the metadata automatically. You can still find the command when it's disabled."
			)
			.addToggle((cb) =>
				cb.setValue(counter_mode.auto).onChange(async (value) => {
					counter_mode.auto = value;
					await this.plugin.saveSettings();
					await this.display();
				})
			);

		if (!counter_mode.auto) return;
		new Setting(containerEl)
			.setName("Metadata Key")
			.setDesc("This is a key/name for the metadata in YAML frontmatter.")
			.addText((text) =>
				text
					.setPlaceholder("Name view counter")
					.setValue(counter_mode.name)
					.onChange(async (value) => {
						let res_value = value.trim().split(" ").join("_");
						res_value = res_value.replace(/:/g, "");
						counter_mode.name = res_value;
						await this.plugin.saveSettings();
						// this.display();
					})
			);

		new Setting(containerEl)
			.setName("Trigger Event")
			.setDesc("This event triggers update the metadata.")
			.addDropdown((cb) =>
				cb
					.addOptions(
						counterTriggerList.reduce((obj, option) => {
							obj[option] = option;
							return obj;
						}, {} as Record<string, string>)
					)
					.setValue(counter_mode.trigger)
					.onChange(async (value) => {
						counter_mode.trigger = value;
						await this.plugin.saveSettings();
						await this.display();
					})
			);

		if (isCustom) {
			new Setting(containerEl)
				.setName("Count Type")
				.setDesc(
					"This is how to update the metadata. Please reset the metadata manually when you change the type."
				)
				.addDropdown((cb) =>
					cb
						.addOptions(
							counterTypeList.reduce((obj, option) => {
								obj[option] = option;
								return obj;
							}, {} as Record<string, string>)
						)
						.setValue(counter_mode.type)
						.onChange(async (value) => {
							counter_mode.type = value;
							await this.plugin.saveSettings();
							await this.display();
						})
				);
		}

		// new Setting(containerEl)
		// 	.setName('Create a New Metadata')
		// 	.setDesc('If there is no metadata named with the specified key, create a new one.')
		// 	.addToggle(cb => cb
		// 		.setValue(counter_mode.create)
		// 		.onChange(async (value) => {
		// 			counter_mode.create = value;
		// 			await this.plugin.saveSettings();
		// 			await this.display();
		// 		}));

		new Setting(containerEl)
			.setName("Notification")
			.setDesc("Notify when the metadata updated.")
			.addToggle((cb) =>
				cb.setValue(counter_mode.notify).onChange(async (value) => {
					counter_mode.notify = value;
					await this.plugin.saveSettings();
					await this.display();
				})
			);

		if (isCustom) {
			new Setting(containerEl).addButton((cb) =>
				cb.setButtonText("-").onClick(async () => {
					this.plugin.settings.customCounterModeList =
						this.plugin.settings.customCounterModeList.filter(
							(i) => i != counter_mode
						);
					await this.plugin.saveSettings();
					await this.display();
				})
			);
		}
	}

	private addCustomCounter(containerEl: HTMLElement) {
		new Setting(containerEl).setName("Create New Counter").addButton((cb) =>
			cb.setButtonText("+").onClick(async (value) => {
				this.plugin.settings.customCounterModeList.push({
					title: "",
					name: "new_counter",
					trigger: "Command",
					type: "count_up",
					auto: true,
					create: false,
					notify: false,
				});
				await this.plugin.saveSettings();
				await this.display();
			})
		);
	}
}
