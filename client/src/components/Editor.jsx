import api from "../api";
import { useState, useEffect } from "react";
import "../styles/editor.css";

function Editor({ chapter, refresh, articleTitle }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    if (chapter) {
      setContent(chapter.content || "");
    }
  }, [chapter]);

  if (!chapter) return <div className="editor">选择章节</div>;

  const save = async () => {
    await api.put(`/chapter/${chapter._id}`, {
      title: chapter.title,
      content,
    });
    refresh();
  };

  const clearContent = async () => {
    await api.put(`/chapter/${chapter._id}`, {
      title: chapter.title,
      content: "",
      message: "清空内容",
    });
    setContent("");
    refresh();
  };

  const exportChapter = () => {
    if (!chapter) return;

    const text = `${articleTitle}\n\n章节：${chapter.title}\n\n${content}`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${chapter.title}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <h2>{chapter.title}</h2>
        <div>
          <button onClick={save}>保存</button>
          <button onClick={clearContent}>清空</button>
          <button onClick={exportChapter}>导出</button>
        </div>
      </div>

      <div className="editor-body">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
    </div>
  );
}

export default Editor;
