import { sanitizeRichText } from "../utils/richText";

function RichTextContent({ value, className = "", emptyLabel = "-" }) {
  const html = sanitizeRichText(value);
  if (!html) {
    return <span>{emptyLabel}</span>;
  }
  return <div className={`rich-text-content ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default RichTextContent;
