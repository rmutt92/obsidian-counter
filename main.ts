import { App, Editor, MarkdownView, Modal, Notice, Menu, Plugin, PluginSettingTab, Setting, parseYaml, stringifyYaml } from 'obsidian';

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
			create: true,
			notify: false
		},
		{
			title: 'Edit Date Logger',
			name: 'edited_dates',
			trigger: 'editor-change',
			type: 'add_date',
			auto: true,
			create: true,
			notify: true
		},
		{
			title: 'Word Counter',
			name: 'words',
			trigger: 'editor-change',
			type: 'word_count',
			auto: true,
			create: true,
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
			create: true,
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

		for (let key in this.triggerList) {
			const trigger = this.triggerList[key];
			this.app.workspace.on(trigger as "quit", async () => { this.updateCounter(trigger); })
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CounterSettingTab(this.app, this));

		// This adds a simple command that can be triggered anywhere
		const allModes = [this.settings.counterModeList, this.settings.customCounterModeList].flat();

		for (let key in allModes) {
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

		if (this.updateYamlFrontMatter(content, mode)) {
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

		for (let key in modes) {
			const mode = modes[key];
			if (!mode.auto) continue;
			const file = await this.app.workspace.getActiveFile();
			if (!file) return;
			const content = await this.app.vault.read(file);
			if (!content) return;

			if (this.updateYamlFrontMatter(content, mode)) {
				this.last_update = { name: mode.name, file_path: file.path }
			}
		}

		this.last_update_time = new Date();
	}


	private findModes(trigger: string): CounterMode[] {
		let res = [];

		const allModes = [this.settings.counterModeList, this.settings.customCounterModeList].flat();
		for (let key in allModes) {
			const mode = allModes[key];
			if (mode.trigger === trigger) { res.push(mode); }
		}

		return res;
	}

	private updateYamlFrontMatter(content: string, mode: CounterMode): boolean {

		const metadata_name = mode.name;
		const trigger = mode.trigger;

		const frontMatterRegex = /---\n([\s\S]*?)\n---\n/;
		const match = content.match(frontMatterRegex);

		if (!match) return false;

		const yaml = parseYaml(match[1]);
		const metadataExists = metadata_name in yaml;

		if (!metadataExists && !mode.create) return false;

		// Parse the YAML front matter using regular expressions
		const frontMatterLines = match[1].split('\n').filter(line => line.trim() !== '');

		let key_tmp = '';
		let val_tmp = '';
		let key_found = false;
		let metadata_end = '\n---\n';

		let current_value_str = null;
		let current_value = yaml[metadata_name];

		for (const line of frontMatterLines) {
			const keyMatch = line.match(/^(\w+):\s*(.*)$/);
			if (keyMatch) {
				// If this is a new key-value pair, store the previous one
				if (key_tmp) {
					if (key_tmp === metadata_name) {
						key_found = key_tmp === metadata_name;
						current_value_str = val_tmp;
						metadata_end = keyMatch[1];
					}
				}

				// Start a new key-value pair
				key_tmp = keyMatch[1];
				val_tmp = keyMatch[2];
			} else {
				// This line is a continuation of the current value
				val_tmp += '\n' + line;
			}
		}

		if (!key_found && !mode.create) return false;


		let sucsess = false;

		switch (mode.type) {
			case 'count_up': 
			case 'count_down':{
				const new_value = current_value_str ? parseInt(current_value) + (mode.type ==  'count_up' ? 1 : -1) : 1;
				sucsess = this.replaceMetadata(content, metadataExists, metadata_name, metadata_end, new_value + '');
				if (sucsess && mode.notify)
					new Notice('Counter\n' + metadata_name + ': +1');
			}
				break;

			case 'add_date': {
				const currentDate = new Date().toISOString().split('T')[0];
				current_value = [current_value].flat();

				if (current_value.includes(currentDate)) return false;

				let new_dates = [...new Set([current_value, currentDate].flat())]
				new_dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
				new_dates = new_dates.filter((item) => item !== undefined) as string[];

				const new_value = '[' + new_dates.join(', ') + ']';

				sucsess = this.replaceMetadata(content, metadataExists, metadata_name, metadata_end, new_value);

				if (sucsess && mode.notify)
					new Notice('Counter\n' + metadata_name + ': +' + currentDate);
			}
				break;

			case 'word_count': {
				const current_value_ = current_value_str ? parseInt(current_value) : 0;
				const new_value = this.countWords(content.substring(content.indexOf('\n---\n')));
				sucsess = this.replaceMetadata(content, metadataExists, metadata_name, metadata_end, new_value + '');
				if (sucsess && mode.notify)
					new Notice('Counter\n' + metadata_name + ': ' + (current_value_ > 1 ? current_value_ + ' -> ' : '') + new_value);
			}
				break;

			default:
				return false;
		}

		return sucsess;
	}

	private replaceMetadata(content: string, update: boolean, metadataName: string, metadata_end: string, newValue: string): boolean {
		const file = this.app.workspace.getActiveFile();
		if (!file) return false;

		if (update) {
			metadataName = metadataName + ': ';
			const metadataStart = content.indexOf(metadataName);
			const metadataEnd = content.indexOf(metadata_end, metadataStart) + metadata_end.length;

			if (metadataStart < 0 || metadataEnd < 0) return false;

			const beforeMetadata = content.substring(0, metadataStart);
			const afterMetadata = content.substring(metadataEnd);

			let new_content = beforeMetadata + metadataName + newValue + (metadata_end == '\n---\n' ? '' : '\n') + metadata_end + afterMetadata;
			this.app.vault.modify(file, new_content);


			return true
		}
		else {

			metadataName = '\n' + metadataName + ': ';
			const metadataStart = content.indexOf(metadata_end);
			const metadataEnd = content.indexOf(metadata_end, metadataStart) + metadata_end.length;

			if (metadataStart < 0 || metadataEnd < 0) return false;

			const beforeMetadata = content.substring(0, metadataStart);
			const afterMetadata = content.substring(metadataEnd);

			const new_content = beforeMetadata + metadataName + newValue + metadata_end + afterMetadata;
			this.app.vault.modify(file, new_content);

			return true
		}

		return false;
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

		for (let key in this.plugin.settings.counterModeList) {
			const counter_mode = this.plugin.settings.counterModeList[key];
			this.addSettingPanel(containerEl, counter_mode, false)
		}

		containerEl.createEl('br');
		containerEl.createEl('br');
		containerEl.createEl('h1', { text: 'Custom Counters' });

		for (let key in this.plugin.settings.customCounterModeList) {
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

		new Setting(containerEl)
			.setName('Create a New Metadata')
			.setDesc('If there is no metadata named with the specified key, create a new one.')
			.addToggle(cb => cb
				.setValue(counter_mode.create)
				.onChange(async (value) => {
					counter_mode.create = value;
					await this.plugin.saveSettings();
					await this.display();
				}));

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

