import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, parseYaml } from 'obsidian';

interface CounterMode {
	title: string,
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
}

const counterTriggerList = ['file-open', 'editor-change', 'command'];
const counterTypeList = ['count_up', 'count_down', 'add_date', 'word_count'];

const DEFAULT_SETTINGS: CounterSettings = {
	counterModeList: [
		{
			title: 'View Counter',
			name: 'views',
			trigger: 'file-open',
			type: 'count_up',
			auto: true,
			create: false,
			notify: false
		},
		{
			title: 'Edit Date Logger',
			name: 'edits',
			trigger: 'editor-change',
			type: 'add_date',
			auto: true,
			create: false,
			notify: true
		},
		{
			title: 'Word Counter',
			name: 'words',
			trigger: 'editor-change',
			type: 'word_count',
			auto: true,
			create: false,
			notify: false
		}
	],

	customCounterModeList: [
		{
			title: 'Rating Logger',
			name: 'ratings',
			trigger: 'command',
			type: 'count_up',
			auto: false,
			create: false,
			notify: false
		}
	]
};

export default class Counter extends Plugin {
	settings: CounterSettings;

	private readonly triggerList = ['file-open', 'editor-change'];

	private last_update = { name: '', file_path: '' };

	private last_update_time = new Date(0);

	async onload() {
		await this.loadSettings();

		for (const key in this.triggerList) {
			const trigger = this.triggerList[key];
			this.app.workspace.on(trigger as "quit", async () => { this.updateCounter(trigger); })
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CounterSettingTab(this.app, this));

		// This adds a simple command that can be triggered anywhere
		const allModes = [this.settings.counterModeList, this.settings.customCounterModeList].flat();

		for (const key in allModes) {
			const mode = allModes[key];
			if (mode.trigger != 'command') continue;

			this.addCommand({
				id: 'counter-' + mode.name,
				name: mode.title,
				callback: () => {
					this.updateCounterCommand(mode);
				}
			});
		}
	}

	async updateCounterCommand(mode: CounterMode) {
		const update_time = new Date();
		if (update_time.getTime() - this.last_update_time.getTime() < 100) return;

		const file = await this.app.workspace.getActiveFile();
		if (!file) return;
		const content = await this.app.vault.read(file);
		if (!content) return;

		if (await this.updateYamlFrontMatter(mode)) {
			this.last_update = { name: mode.name, file_path: file.path }
		}

		this.last_update_time = new Date();
	}


	async updateCounter(trigger: string) {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;

		const update_time = new Date();
		if (update_time.getTime() - this.last_update_time.getTime() < 100) return;

		const modes = this.findModes(trigger)

		for (const key in modes) {
			const mode = modes[key];
			if (!mode.auto) continue;


			if (await this.updateYamlFrontMatter(mode)) {
				this.last_update = { name: mode.name, file_path: file.path }
			}
		}

		this.last_update_time = new Date();
	}


	private findModes(trigger: string): CounterMode[] {
		const res = [];

		const allModes = [this.settings.counterModeList, this.settings.customCounterModeList].flat();
		for (const key in allModes) {
			const mode = allModes[key];
			if (mode.trigger === trigger) { res.push(mode); }
		}

		return res;
	}

	private getEditor(): Editor | null {
		const activeLeaf: MarkdownView | null = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeLeaf) return null;
		return activeLeaf.editor;
	}

	private async updateYamlFrontMatter(mode: CounterMode): Promise<boolean> {

		const file = await this.app.workspace.getActiveFile();
		if (!file) return false;

		const content = await this.app.vault.read(file);
		if (!content) return false;

		const metadata_name = mode.name;

		const frontMatterRegex = /---\n([\s\S]*?)\n---\n/;
		const match = content.match(frontMatterRegex);
		const firstLinePos = content.indexOf('---\n');

		if (!match) return false;

		const yaml = parseYaml(match[1]);
		const metadataExists = metadata_name in yaml;

		if (!metadataExists && !mode.create) return false;

		const yamlExists = match != null;

		if (!yamlExists && !mode.create) return false;

		const editor = await this.getEditor();
		if (!editor) return false;

		const cursorPos = editor.getCursor('head');
		const lines = match ? match[1].split('\n') : [''];
		const yamlLinesLen = firstLinePos + lines.length + 2;

		if (cursorPos.line < yamlLinesLen) return false;

		// const fileManager = this.app.fileManager;

		function updateFrontmatter(new_value: string) {

			const lines = match ? match[1].split('\n') : [''];

			if (metadataExists) {
				let line_pos = -1;
				// let line_end_pos = -1;

				for (let i = 0, size = lines.length; i < size; i++) {
					const line = lines[i];

					if (line.indexOf(metadata_name + ':') != 0) continue;

					// for (let j = i + 1, size = lines.length; j < size; j++) {
					// 	if (line_pos < 0) {
					// 		const line2 = lines[j];
					// 		const comma_pos = line2.indexOf(': ');

					// 		if (comma_pos > 0 && !line.substring(0, comma_pos).includes(' ')) {
					// 			// Next metadata found
					// 			line_end_pos = j;
					// 		}
					// 	}
					// }

					line_pos = i;

					// const next_metadata_found = line_end_pos > -1;

					const rangeFrom = { line: line_pos + 1, ch: 0 };
					const rangeTo = { line: line_pos + 2, ch: 0 };
					// const rangeTo = next_metadata_found ? { line: line_end_pos+1, ch: 0} : { line: line_pos+2, ch: 0 };

					// editor.replaceRange(metadata_name + ': ' + new_value, rangeFrom, rangeTo);d

					const new_line = metadata_name + ': ' + new_value + '\n';

					// make sure that they are considered one change so that undo will only need to happen once for a multicursor paste
					if (editor) editor.replaceRange(new_line, rangeFrom, rangeTo);
					return;
				}
			} 
			// else {
			// 	const insertPos = yamlLinesLen - 1;
			// 	const rangeFrom = { line: insertPos, ch: 0 };
			// 	const rangeTo = { line: insertPos + 1, ch: 0 };
			// 	// const rangeTo = next_metadata_found ? { line: line_end_pos+1, ch: 0} : { line: line_pos+2, ch: 0 };

			// 	// editor.replaceRange(metadata_name + ': ' + new_value, rangeFrom, rangeTo);d
			// 	const new_line = metadata_name + ': ' + new_value + '\n---\n';

			// 	// make sure that they are considered one change so that undo will only need to happen once for a multicursor paste
			// 	// W.I.P It doesn't work properly
			// 	// if (editor) editor.replaceRange(new_line, rangeFrom, rangeTo);

			// }

			// try {
			// 	fileManager.processFrontMatter(file, (frontmatter) => {
			// 		// Modify the frontmatter object here
			// 		frontmatter[metadata_name] = new_value;
			// 	});
			// } catch (error) {
			// 	console.error(`Error modifying frontmatter for ${file.path}:`, error);
			// }

			return;
		}

		function readFrontmatter() {
			return yaml[metadata_name];
		}

		function arraysEqual(a: string[], b: string[]) {
			if (a.length !== b.length) return false;
			return a.every((element, index) => element === b[index] && index === b.indexOf(element));
		}

		const current_value = await readFrontmatter();

		let sucsess = false;

		switch (mode.type) {
			case 'count_up':
			case 'count_down': {
				if (current_value == null && !mode.auto) return false;

				const new_value = current_value != null ? parseInt(current_value) + (mode.type == 'count_up' ? 1 : -1) : 1;

				await updateFrontmatter(new_value.toString());

				const updated_value = await readFrontmatter();
				sucsess = updated_value != null ? parseInt(updated_value) == new_value : false;

				if (sucsess && mode.notify)
					new Notice('Counter\n' + metadata_name + ': +1');
			}

				break;

			case 'add_date': {
				if (current_value == null && !mode.auto) return false;

				const currentDate = new Date().toISOString().split('T')[0];
				let current_arr = [currentDate];

				if (current_value != null) {
					current_arr = [current_value].flat();
					const current_dates = [...new Set(current_value)] as string[];
					current_dates.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());

					if (current_dates.includes(currentDate) && arraysEqual(current_dates, current_arr)) return false;
				}

				let new_dates = [...new Set([current_value, currentDate].flat())]
				new_dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

				new_dates = new_dates.filter((item) => item !== undefined && item !== null) as string[];

				const new_value = '[' + new_dates.join(', ') + ']';
				await updateFrontmatter(new_value);

				const updated_value = await readFrontmatter();
				sucsess = updated_value != null ? arraysEqual(updated_value, new_dates) : false;

				if (sucsess && mode.notify)
					new Notice('Counter\n' + metadata_name + ': +' + currentDate);
			}
				break;

			case 'word_count': {
				if (current_value == null && !mode.auto) return false;

				const current_value_ = current_value != null ? parseInt(current_value) : 0;
				const new_value = await this.countWords(content.substring(content.indexOf('\n---\n')));

				await updateFrontmatter(new_value.toString());

				const updated_value = await readFrontmatter();
				sucsess = updated_value != null ? parseInt(updated_value) == new_value : false;

				if (sucsess && mode.notify)
					new Notice('Counter\n' + metadata_name + ': ' + (current_value_ > 1 ? current_value_ + ' -> ' : '') + new_value);
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

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		containerEl.createEl('h1', { text: 'Counter' });

		for (const key in this.plugin.settings.counterModeList) {
			const counter_mode = this.plugin.settings.counterModeList[key];
			this.addSettingPanel(containerEl, counter_mode, false)
		}

		containerEl.createEl('br');
		containerEl.createEl('br');
		containerEl.createEl('h1', { text: 'Custom Counters' });

		for (const key in this.plugin.settings.customCounterModeList) {
			const counter_mode = this.plugin.settings.customCounterModeList[key];
			this.addSettingPanel(containerEl, counter_mode, true)
		}

		containerEl.createEl('br');
		containerEl.createEl('br');
		containerEl.createEl('h2', { text: 'Notes:' });
		containerEl.createEl('li', { text: 'Nested key is not supported yet.' });

	}

	private addSettingPanel(containerEl: HTMLElement, counter_mode: CounterMode, isCustom: boolean) {
		containerEl.createEl('br');
		containerEl.createEl('h2', { text: counter_mode.title });

		// if (!counter_mode.auto) return;
		new Setting(containerEl)
			.setName('Enable')
			.setDesc('Update the metadata automatically.')
			.addToggle(cb => cb
				.setValue(counter_mode.auto)
				.onChange(async (value) => {
					counter_mode.auto = value;
					await this.plugin.saveSettings();
					await this.display();
				}))

		if (!counter_mode.auto) return;
		new Setting(containerEl)
			.setName('Metadata Key')
			.setDesc('This is a key/name for the metadata in YAML front matter.')
			.addText(text => text
				.setPlaceholder('Name view counter')
				.setValue(counter_mode.name)
				.onChange(async (value) => {
					let res_value = value.trim().split(' ').join('_');
					res_value = res_value.replace(/:/g, '');
					counter_mode.name = res_value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Trigger Event')
			.setDesc('This event triggers update the metadata.')
			.addDropdown(cb => cb
				.addOptions(counterTriggerList.reduce((obj, option) => {
					obj[option] = option;
					return obj;
				}, {} as Record<string, string>))
				.setValue(counter_mode.trigger)
				.onChange(async (value) => {
					counter_mode.trigger = value;
					await this.plugin.saveSettings();
					await this.display();
				}))

		if (isCustom) {
			new Setting(containerEl)
				.setName('Count Type')
				.setDesc('This is how to update the metadata. Please reset the metadata manually when you change the type.')
				.addDropdown(cb => cb
					.addOptions(counterTypeList.reduce((obj, option) => {
						obj[option] = option;
						return obj;
					}, {} as Record<string, string>))
					.setValue(counter_mode.type)
					.onChange(async (value) => {
						counter_mode.type = value;
						await this.plugin.saveSettings();
						await this.display();
					}))
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
			.setName('Notification')
			.setDesc('Notify when the metadata updated.')
			.addToggle(cb => cb
				.setValue(counter_mode.notify)
				.onChange(async (value) => {
					counter_mode.notify = value;
					await this.plugin.saveSettings();
					await this.display();
				}));
	}
}

