'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code2, Focus, Heading1,
  Heading2, Highlighter, ImagePlus, ImageUp, Indent, Italic, Link2, List, ListOrdered,
  Loader2, Maximize2, Minimize2, Minus, Outdent, Quote, Redo2, RemoveFormatting,
  Strikethrough, Subscript, Superscript, Table2, Underline, Undo2, Unlink,
} from 'lucide-react';
import { adminAPI } from '@/src/lib/api';

const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'EM', 'FIGCAPTION',
  'FIGURE', 'FONT', 'H1', 'H2', 'H3', 'H4', 'HR', 'I', 'IMG', 'LI', 'OL',
  'P', 'PRE', 'S', 'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY',
  'TD', 'TH', 'THEAD', 'TR', 'U', 'UL',
]);
const ALLOWED_STYLES = new Set(['color', 'background-color', 'text-align', 'font-size']);

function safeUrl(value: string, image = false) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  return image && (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../'));
}

function describeUploadError(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return 'Não foi possível carregar a imagem. Verifique a ligação e tente novamente.';
}

export function sanitizeEditorHtml(html: string) {
  if (typeof window === 'undefined') return html;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  if (!/<[a-z][^>]*>/i.test(html) && parsed.body.textContent?.trim()) {
    return parsed.body.textContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      .join('');
  }
  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (!(node instanceof HTMLElement)) return null;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(node.tagName)) return null;
    if (!ALLOWED_TAGS.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        const cleanChild = cleanNode(child);
        if (cleanChild) fragment.appendChild(cleanChild);
      });
      return fragment;
    }
    const clean = document.createElement(node.tagName.toLowerCase());
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name === 'href' && node.tagName === 'A' && safeUrl(value)) clean.setAttribute('href', value);
      if (name === 'src' && node.tagName === 'IMG' && safeUrl(value, true)) clean.setAttribute('src', value);
      if (name === 'alt' && node.tagName === 'IMG') clean.setAttribute('alt', value.slice(0, 300));
      if (name === 'title' && (node.tagName === 'A' || node.tagName === 'IMG')) clean.setAttribute('title', value.slice(0, 300));
      if (name === 'target' && node.tagName === 'A' && value === '_blank') clean.setAttribute('target', '_blank');
      if (name === 'style') {
        const styles = value.split(';').flatMap((rule) => {
          const [property, ...parts] = rule.split(':');
          const key = property?.trim().toLowerCase();
          const styleValue = parts.join(':').trim();
          if (!key || !styleValue || !ALLOWED_STYLES.has(key) || /url\s*\(|expression|[<>]/i.test(styleValue)) return [];
          if (key === 'text-align' && !/^(left|right|center|justify)$/i.test(styleValue)) return [];
          if (key === 'font-size' && !/^(?:\d+(?:\.\d+)?(?:px|em|rem|%))$/i.test(styleValue)) return [];
          if ((key === 'color' || key === 'background-color') && !/^(?:#[0-9a-f]{3,8}|rgb[a]?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(styleValue)) return [];
          return [`${key}: ${styleValue}`];
        });
        if (styles.length) clean.setAttribute('style', styles.join('; '));
      }
      if (name === 'color' && node.tagName === 'FONT' && /^#[\da-f]{3,8}$|^[a-z]{3,20}$/i.test(value)) clean.setAttribute('color', value);
      if (name === 'size' && node.tagName === 'FONT' && /^[1-7]$/.test(value)) clean.setAttribute('size', value);
    }
    if (clean.tagName === 'A' && clean.getAttribute('target') === '_blank') clean.setAttribute('rel', 'noopener noreferrer');
    node.childNodes.forEach((child) => {
      const cleanChild = cleanNode(child);
      if (cleanChild) clean.appendChild(cleanChild);
    });
    return clean;
  };

  const result = document.createElement('div');
  parsed.body.childNodes.forEach((node) => {
    const clean = cleanNode(node);
    if (clean) result.appendChild(clean);
  });
  return result.innerHTML;
}

interface BlogRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function BlogRichTextEditor({ value, onChange }: BlogRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastEmittedValue = useRef<string | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || sourceMode) return;
    if (value === lastEmittedValue.current) return;
    const safeValue = sanitizeEditorHtml(value);
    if (editor.innerHTML !== safeValue) editor.innerHTML = safeValue;
    lastEmittedValue.current = safeValue;
    setSourceValue(safeValue);
  }, [value, sourceMode]);

  const rememberSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  }, []);

  const focusContent = useCallback(() => {
    if (sourceMode) {
      sourceEditorRef.current?.focus();
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    if (savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange.current = range.cloneRange();
  }, [sourceMode]);

  const syncEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const content = editor.innerHTML;
    rememberSelection();
    lastEmittedValue.current = content;
    onChange(content);
  }, [onChange, rememberSelection]);

  const runCommand = useCallback((command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncEditor();
  }, [restoreSelection, syncEditor]);

  const addLink = () => {
    restoreSelection();
    const url = window.prompt('Insira o endereço do link (https://...)');
    if (!url) return;
    if (!safeUrl(url)) {
      window.alert('Insira um endereço http://, https:// ou mailto: válido.');
      return;
    }
    document.execCommand('createLink', false, url.trim());
    syncEditor();
  };

  const addImage = () => {
    restoreSelection();
    const url = window.prompt('Insira o endereço público da imagem (https://...)');
    if (!url) return;
    if (!safeUrl(url, true) || !/^https?:/i.test(url)) {
      window.alert('Para imagens por URL use um endereço http:// ou https://. Para ficheiros do computador, use o botão "Carregar imagem do computador".');
      return;
    }
    const alt = window.prompt('Texto alternativo da imagem (acessibilidade)') || '';
    document.execCommand('insertHTML', false, `<img src="${url.replace(/"/g, '&quot;')}" alt="${alt.replace(/["&<>]/g, '')}" style="max-width:100%;height:auto;border-radius:12px" />`);
    syncEditor();
  };

  const ensureCaret = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return null;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return null;
    if (savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
      return editor;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange.current = range.cloneRange();
    return editor;
  }, []);

  const insertImageMarkup = (url: string, alt: string) => {
    const editor = ensureCaret();
    if (!editor) return;
    const src = url.replace(/"/g, '&quot;');
    const caption = alt ? `<figcaption>${alt}</figcaption>` : '';
    const markup = `<figure><img src="${src}" alt="${alt}" />${caption}</figure><p><br></p>`;
    const inserted = document.execCommand('insertHTML', false, markup);
    if (!inserted) editor.insertAdjacentHTML('beforeend', markup);
    syncEditor();
  };

  const openImagePicker = () => {
    setUploadError(null);
    setUploadNotice(null);
    rememberSelection();
    fileInputRef.current?.click();
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setUploadError(null);
    setUploadNotice(null);
    if (!file) return;
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setUploadError('Formato não suportado. Use JPG, PNG, WEBP ou GIF.');
      input.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('A imagem excede 5 MB. Otimize o ficheiro antes de carregar.');
      input.value = '';
      return;
    }
    setIsUploading(true);
    try {
      const { data } = await adminAPI.uploadBlogImage(file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/["&<>]/g, '').trim().slice(0, 150);
      insertImageMarkup(data.url, alt);
      setUploadNotice(`Imagem “${file.name}” inserida no artigo.`);
    } catch (error) {
      setUploadError(describeUploadError(error));
    } finally {
      setIsUploading(false);
      input.value = '';
    }
  };

  const addTable = () => {
    rememberSelection();
    const rowInput = window.prompt('Número de linhas (2–8)', '3');
    if (rowInput === null) return;
    const columnInput = window.prompt('Número de colunas (2–6)', '3');
    if (columnInput === null) return;
    const rows = Number(rowInput);
    const columns = Number(columnInput);
    if (!Number.isInteger(rows) || rows < 2 || rows > 8 || !Number.isInteger(columns) || columns < 2 || columns > 6) {
      window.alert('Escolha entre 2 e 8 linhas e entre 2 e 6 colunas.');
      return;
    }
    const cells = (tag: 'th' | 'td') => `<tr>${Array.from({ length: columns }, () => `<${tag}>${tag === 'th' ? 'Cabeçalho' : 'Texto'}</${tag}>`).join('')}</tr>`;
    const table = `<table><thead>${cells('th')}</thead><tbody>${Array.from({ length: rows - 1 }, () => cells('td')).join('')}</tbody></table><p><br></p>`;
    restoreSelection();
    document.execCommand('insertHTML', false, table);
    syncEditor();
  };

  const changeBlock = (tag: string) => runCommand('formatBlock', `<${tag}>`);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      (document.getElementById('blog-editor-form') as HTMLFormElement | null)?.requestSubmit();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      addLink();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const content = html ? sanitizeEditorHtml(html) : `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
    restoreSelection();
    document.execCommand('insertHTML', false, content);
    syncEditor();
  };

  const toggleSource = () => {
    if (!sourceMode) {
      setSourceValue(sanitizeEditorHtml(editorRef.current?.innerHTML || value));
      setSourceMode(true);
      window.requestAnimationFrame(() => sourceEditorRef.current?.focus());
    } else {
      const safeValue = sanitizeEditorHtml(sourceValue);
      setSourceValue(safeValue);
      lastEmittedValue.current = safeValue;
      onChange(safeValue);
      setSourceMode(false);
      window.requestAnimationFrame(restoreSelection);
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
      return;
    }
    rememberSelection();
    setIsFullscreen(true);
  };

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    window.requestAnimationFrame(focusContent);
  }, [focusContent]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(focusContent);
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [exitFullscreen, focusContent, isFullscreen]);

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm${isFullscreen ? ' blog-rich-editor-fullscreen' : ''}`}>
      <div role="toolbar" aria-label="Ferramentas de edição do artigo" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <select aria-label="Estilo de parágrafo" defaultValue="p" onChange={(event) => changeBlock(event.target.value)} className="h-9 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400">
          <option value="p">Parágrafo</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="h4">Título 4</option>
          <option value="blockquote">Citação</option>
          <option value="pre">Código</option>
        </select>
        <select aria-label="Tamanho do texto selecionado" defaultValue="" onChange={(event) => { if (event.target.value) runCommand('fontSize', event.target.value); event.currentTarget.value = ''; }} className="h-9 max-w-28 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400">
          <option value="" disabled>Tamanho</option>
          <option value="2">Pequeno</option>
          <option value="3">Normal</option>
          <option value="4">Grande</option>
          <option value="5">Muito grande</option>
        </select>
        <ToolbarButton label="Negrito" shortcut="Ctrl+B" onClick={() => runCommand('bold')}><Bold /></ToolbarButton>
        <ToolbarButton label="Itálico" shortcut="Ctrl+I" onClick={() => runCommand('italic')}><Italic /></ToolbarButton>
        <ToolbarButton label="Sublinhado" shortcut="Ctrl+U" onClick={() => runCommand('underline')}><Underline /></ToolbarButton>
        <ToolbarButton label="Rasurado" onClick={() => runCommand('strikeThrough')}><Strikethrough /></ToolbarButton>
        <span className="mx-1 hidden h-6 border-l border-slate-200 sm:block" />
        <ToolbarButton label="Título 1" onClick={() => changeBlock('h2')}><Heading1 /></ToolbarButton>
        <ToolbarButton label="Título 2" onClick={() => changeBlock('h3')}><Heading2 /></ToolbarButton>
        <ToolbarButton label="Lista com marcadores" onClick={() => runCommand('insertUnorderedList')}><List /></ToolbarButton>
        <ToolbarButton label="Lista numerada" onClick={() => runCommand('insertOrderedList')}><ListOrdered /></ToolbarButton>
        <ToolbarButton label="Citação" onClick={() => changeBlock('blockquote')}><Quote /></ToolbarButton>
        <ToolbarButton label="Código" onClick={() => changeBlock('pre')}><Code2 /></ToolbarButton>
        <span className="mx-1 hidden h-6 border-l border-slate-200 sm:block" />
        <ToolbarButton label="Alinhar à esquerda" onClick={() => runCommand('justifyLeft')}><AlignLeft /></ToolbarButton>
        <ToolbarButton label="Centrar" onClick={() => runCommand('justifyCenter')}><AlignCenter /></ToolbarButton>
        <ToolbarButton label="Alinhar à direita" onClick={() => runCommand('justifyRight')}><AlignRight /></ToolbarButton>
        <ToolbarButton label="Justificar" onClick={() => runCommand('justifyFull')}><AlignJustify /></ToolbarButton>
        <ToolbarButton label="Diminuir avanço" onClick={() => runCommand('outdent')}><Outdent /></ToolbarButton>
        <ToolbarButton label="Aumentar avanço" onClick={() => runCommand('indent')}><Indent /></ToolbarButton>
        <ToolbarButton label="Inserir link" shortcut="Ctrl+K" onClick={addLink}><Link2 /></ToolbarButton>
        <ToolbarButton label="Remover link" onClick={() => runCommand('unlink')}><Unlink /></ToolbarButton>
        <ToolbarButton label="Inserir imagem por URL" onClick={addImage} disabled={sourceMode}><ImagePlus /></ToolbarButton>
        <ToolbarButton
          label={isUploading ? 'A carregar imagem…' : 'Carregar imagem do computador'}
          onClick={openImagePicker}
          pressed={isUploading}
          disabled={sourceMode || isUploading}
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
        </ToolbarButton>
        <ToolbarButton label="Inserir tabela" onClick={addTable}><Table2 /></ToolbarButton>
        <ToolbarButton label="Linha horizontal" onClick={() => runCommand('insertHorizontalRule')}><Minus /></ToolbarButton>
        <label onPointerDown={rememberSelection} className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200" title="Cor do texto">
          <span className="sr-only">Cor do texto</span>
          <span className="text-sm font-bold">A</span>
          <input type="color" aria-label="Cor do texto" defaultValue="#1f2937" onPointerDown={rememberSelection} onChange={(event) => runCommand('foreColor', event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <span className="absolute bottom-1 h-1 w-4 rounded bg-indigo-600" />
        </label>
        <label onPointerDown={rememberSelection} className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200" title="Realce de texto">
          <span className="sr-only">Realce de texto</span>
          <Highlighter size={17} />
          <input type="color" aria-label="Cor do realce" defaultValue="#fef08a" onPointerDown={rememberSelection} onChange={(event) => runCommand('hiliteColor', event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <ToolbarButton label="Subscrito" onClick={() => runCommand('subscript')}><Subscript /></ToolbarButton>
        <ToolbarButton label="Sobrescrito" onClick={() => runCommand('superscript')}><Superscript /></ToolbarButton>
        <ToolbarButton label="Remover formatação" onClick={() => runCommand('removeFormat')}><RemoveFormatting /></ToolbarButton>
        <ToolbarButton label="Desfazer" shortcut="Ctrl+Z" onClick={() => runCommand('undo')}><Undo2 /></ToolbarButton>
        <ToolbarButton label="Refazer" shortcut="Ctrl+Y" onClick={() => runCommand('redo')}><Redo2 /></ToolbarButton>
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton label="Focar na área de conteúdo" onClick={focusContent}><Focus /></ToolbarButton>
          <ToolbarButton
            label={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
            onClick={toggleFullscreen}
            pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </ToolbarButton>
          <button type="button" onMouseDown={rememberSelection} onClick={toggleSource} aria-pressed={sourceMode} className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold ${sourceMode ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>{sourceMode ? 'Visual' : 'HTML'}</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleImageFile}
      />

      {sourceMode ? (
        <textarea ref={sourceEditorRef} value={sourceValue} onChange={(event) => setSourceValue(event.target.value)} aria-label="Código HTML do artigo" spellCheck={false} className="min-h-[360px] w-full resize-y bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-100 outline-none sm:min-h-[480px]" />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Conteúdo do artigo"
          aria-multiline="true"
          data-placeholder="Comece a escrever o seu artigo…"
          spellCheck
          onInput={syncEditor}
          onMouseUp={rememberSelection}
          onKeyUp={rememberSelection}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={(event) => event.preventDefault()}
          className="blog-rich-editor min-h-[360px] px-4 py-5 outline-none sm:min-h-[480px] sm:px-8 sm:py-7"
        />
      )}
      {(uploadError || uploadNotice || isUploading) && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2 border-t px-3 py-2 text-xs sm:px-4 ${uploadError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}
        >
          {isUploading && <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />}
          <span>{isUploading ? 'A carregar a imagem para o servidor…' : uploadError || uploadNotice}</span>
          {!isUploading && (
            <button
              type="button"
              onClick={() => {
                setUploadError(null);
                setUploadNotice(null);
              }}
              className="ml-auto shrink-0 rounded px-1.5 font-semibold underline decoration-dotted"
            >
              Fechar
            </button>
          )}
        </div>
      )}
      <footer className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        {/* <span>Selecione o texto para formatar. Atalhos: Ctrl+B, Ctrl+I, Ctrl+K.</span>
        <span>O HTML colado é limpo automaticamente.</span> */}
      </footer>
    </div>
  );
}

function ToolbarButton({ label, shortcut, onClick, pressed, disabled, children }: { label: string; shortcut?: string; onClick: () => void; pressed?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={pressed} title={shortcut ? `${label} (${shortcut})` : label} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}
