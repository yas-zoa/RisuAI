<script lang="ts">
    import CodeMirrorEditor from '../UI/GUI/CodeMirrorEditor.svelte'

    let selectedLang = $state<'markdown' | 'html' | 'plain'>('markdown')
    let editorValue = $state(getSampleText('markdown'))

    function getSampleText(lang: 'markdown' | 'html' | 'plain') {
        if (lang === 'markdown') {
            return `# Hello World

This is **bold** and *italic* text.
Also ***bold italic*** and ~~strikethrough~~.

{{char}} says hello to {{user}}.

## CBS Variables
- \`{{char}}\` - Character name
- \`{{user}}\` - User name

## Nested CBS
{{#if {{getvar::mood}}}}
  {{char}} is feeling {{getvar::mood}}.
  {{#if {{equal::{{getvar::mood}}::happy}}}}
    😊
  {{/if}}
{{/if}}

<custom_tag>
## Markdown inside XML
This **bold** and *italic* works inside XML tags!
Even ~~strikethrough~~ and \`inline code\` work here.
</custom_tag>

\`\`\`javascript
console.log("Hello");
\`\`\`
`
        } else if (lang === 'html') {
            return `<div class="container">
    <h1>Hello {{char}}</h1>
    <p>Welcome, {{user}}!</p>

    <!-- This is a comment -->
    <custom-element data-value="test">
        {{#if {{getvar::show}}}}
            Content here
        {{/if}}
    </custom-element>
</div>`
        }
        return 'Plain text here...\n\n{{char}} and {{user}}'
    }

    function switchLang(lang: typeof selectedLang) {
        selectedLang = lang
        editorValue = getSampleText(lang)
    }
</script>

<h2 class="text-4xl text-textcolor my-6 font-black relative">CodeMirror Test</h2>

<div class="flex gap-2 mb-4">
    <button
        class="px-4 py-2 rounded-md transition-colors {selectedLang === 'markdown' ? 'bg-green-600' : 'bg-darkbg hover:bg-selected'}"
        onclick={() => switchLang('markdown')}
    >
        Markdown
    </button>
    <button
        class="px-4 py-2 rounded-md transition-colors {selectedLang === 'html' ? 'bg-green-600' : 'bg-darkbg hover:bg-selected'}"
        onclick={() => switchLang('html')}
    >
        HTML/XML
    </button>
    <button
        class="px-4 py-2 rounded-md transition-colors {selectedLang === 'plain' ? 'bg-green-600' : 'bg-darkbg hover:bg-selected'}"
        onclick={() => switchLang('plain')}
    >
        Plain
    </button>
</div>

<span class="text-textcolor text-lg mb-2 block">Editor</span>

<CodeMirrorEditor
    bind:value={editorValue}
    lang={selectedLang}
    class="min-h-[400px]"
/>

<p class="text-textcolor2 mt-4 text-sm">
    CBS syntax is highlighted with nesting level colors. Markdown (bold, italic, strikethrough, code) works everywhere, including inside XML tags.
</p>
