import api from "../api";
import { useState } from "react";

function Sidebar({
  articleId,
  chapters,
  onSelectChapter,
  refresh,
  onDeleteChapter,
}) {
  const [title, setTitle] = useState("");

  const isDuplicate = (name) => {
    return chapters.some(
      (c) => c.title.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  };

  const createChapter = async () => {
    if (!title.trim()) return;

    if (isDuplicate(title)) {
      alert("章节已存在");
      setTitle("");
      return;
    }

    await api.post("http://localhost:5000/chapter", {
      articleId,
      title,
    });

    setTitle("");
    refresh();
  };

  const editChapter = async (id, oldTitle) => {
    const t = prompt("edit", oldTitle);
    if (!t?.trim()) return;

    if (isDuplicate(t)) {
      alert("章节已存在");
      return;
    }

    await api.put(`http://localhost:5000/chapter/${id}`, {
      title: t,
    });

    refresh();
  };

  return (
    <div className="sidebar">
      <h3>章节</h3>

      <div className="chapter-create">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />

        <button onClick={createChapter}>新增</button>
      </div>

      <hr />
      {chapters.map((c) => (
        <div
          key={c._id}
          className="chapter-card"
          onClick={() => onSelectChapter(c)}
        >
          <div>{c.title}</div>

          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                editChapter(c._id, c.title);
              }}
            >
              ✎
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChapter(c._id);
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Sidebar;
