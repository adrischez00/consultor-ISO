import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import { normalizeRichText, richTextToEditorValue, richTextToPlainText } from "../utils/richText";

const RICH_TEXT_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ["small", false, "large", "huge"] }],
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["blockquote", "code-block", "link"],
    ["clean"],
  ],
};

const RICH_TEXT_FORMATS = [
  "font",
  "size",
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "bullet",
  "indent",
  "align",
  "blockquote",
  "code-block",
  "link",
];

function RichTextarea({
  className = "",
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  name,
  id,
}) {
  const editorValue = richTextToEditorValue(value);
  const plainValue = richTextToPlainText(editorValue);
  const isDisabled = Boolean(disabled || readOnly);

  function emitChange(nextValue) {
    if (typeof onChange !== "function") return;
    const normalized = normalizeRichText(nextValue);
    onChange({ target: { value: normalized } });
  }

  function emitBlur(_range, _source, editor) {
    if (typeof onBlur !== "function") return;
    const normalized = normalizeRichText(editor.getHTML?.() || editorValue);
    onBlur({ target: { value: normalized } });
  }

  return (
    <div className={`rich-textarea ${className}`.trim()}>
      <input
        className="rich-textarea-proxy-input"
        tabIndex={-1}
        aria-hidden="true"
        type="text"
        value={plainValue}
        onChange={() => {}}
        required={required}
        disabled={isDisabled}
        name={name}
        id={id}
      />
      <ReactQuill
        theme="snow"
        value={editorValue}
        onChange={emitChange}
        onBlur={emitBlur}
        readOnly={isDisabled}
        modules={RICH_TEXT_MODULES}
        formats={RICH_TEXT_FORMATS}
        placeholder={placeholder}
      />
    </div>
  );
}

export default RichTextarea;
