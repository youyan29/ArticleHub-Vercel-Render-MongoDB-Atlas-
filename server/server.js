require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Article = require("./models/Article");
const Chapter = require("./models/Chapter");
const Version = require("./models/Version");
const User = require("./models/User");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   uploads
========================= */

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =========================
   mongo
========================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Mongo Connected");
  })
  .catch((err) => {
    console.log("Mongo Error:", err);
  });

/* =========================
   jwt auth middleware
========================= */

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "no token",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;

    next();
  } catch {
    return res.status(401).json({
      message: "invalid token",
    });
  }
};

/* =========================
   User
========================= */

// register
// server.js
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: "username exists" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({ username, password: hash });

    // 生成 token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    res.json({ token, username: user.username });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
});

// login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      username,
    });

    if (!user) {
      return res.status(400).json({
        message: "user not found",
      });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(400).json({
        message: "password incorrect",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
      },

      process.env.JWT_SECRET
    );

    res.json({
      token,
      username: user.username,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================
   Article
========================= */

// create
app.post("/article", auth, async (req, res) => {
  try {
    const { title } = req.body;

    const exists = await Article.findOne({
      title,
      userId: req.userId,
    });

    if (exists) {
      return res.status(400).json({
        message: "Article title already exists",
      });
    }

    const article = await Article.create({
      title,

      cover: req.body.cover,

      userId: req.userId,
    });

    res.json(article);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// get articles
app.get("/articles", auth, async (req, res) => {
  try {
    const articles = await Article.find({
      userId: req.userId,
    });

    const result = await Promise.all(
      articles.map(async (a) => {
        const count = await Chapter.countDocuments({
          articleId: a._id,
        });

        return {
          ...a.toObject(),

          chapterCount: count,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// get one article
app.get("/article/:id", auth, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,

      userId: req.userId,
    });

    if (!article) {
      return res.status(404).json({
        message: "article not found",
      });
    }

    res.json(article);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// update article
app.put("/article/:id", auth, async (req, res) => {
  try {
    const { title, cover } = req.body;

    const exists = await Article.findOne({
      title,

      userId: req.userId,
    });

    if (exists && exists._id.toString() !== req.params.id) {
      return res.status(400).json({
        message: "Article title already exists",
      });
    }

    const updateData = {};

    if (title) {
      updateData.title = title;
    }

    if (cover && typeof cover === "object" && cover.type && cover.value) {
      updateData.cover = cover;
    }

    const article = await Article.findOneAndUpdate(
      {
        _id: req.params.id,

        userId: req.userId,
      },

      {
        $set: updateData,
      },

      {
        returnDocument: "after",
      },
    );

    res.json(article);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// delete article
app.delete("/article/:id", auth, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,

      userId: req.userId,
    });

    if (!article) {
      return res.status(404).json({
        message: "article not found",
      });
    }

    const chapters = await Chapter.find({
      articleId: req.params.id,
    });

    const ids = chapters.map((c) => c._id);

    await Version.deleteMany({
      chapterId: {
        $in: ids,
      },
    });

    await Chapter.deleteMany({
      articleId: req.params.id,
    });

    await Article.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================
   Chapter
========================= */

app.post("/chapter", auth, async (req, res) => {
  try {
    const { articleId, title } = req.body;

    const article = await Article.findOne({
      _id: articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    const exists = await Chapter.findOne({
      articleId,
      title,
    });

    if (exists) {
      return res.status(400).json({
        message: "Chapter title already exists in this article",
      });
    }

    const chapter = await Chapter.create({
      articleId,
      title,
      content: "",
    });

    res.json(chapter);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

app.get("/chapters/:articleId", auth, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    const list = await Chapter.find({
      articleId: req.params.articleId,
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

app.put("/chapter/:id", auth, async (req, res) => {
  try {
    const title = req.body.title?.trim();

    const content = req.body.content;

    const current = await Chapter.findById(req.params.id);

    if (!current) {
      return res.status(404).json({
        message: "chapter not found",
      });
    }

    const article = await Article.findOne({
      _id: current.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    if (title && title !== current.title?.trim()) {
      const exists = await Chapter.findOne({
        articleId: current.articleId,

        title,
      });

      if (exists) {
        return res.status(400).json({
          message: "Chapter already exists",
        });
      }
    }

    const contentChanged = content !== current.content;

    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,

      {
        title,
        content,
      },

      {
        returnDocument: "after",
      },
    );

    if (contentChanged) {
      await Version.create({
        chapterId: chapter._id,

        title: chapter.title,

        content: chapter.content,

        message: req.body.message || "manual save",

        time: new Date(),

        isRestore: false,
      });
    }

    res.json(chapter);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

app.delete("/chapter/:id", auth, async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id);

    if (!chapter) {
      return res.status(404).json({
        message: "chapter not found",
      });
    }

    const article = await Article.findOne({
      _id: chapter.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    await Version.deleteMany({
      chapterId: chapter._id,
    });

    await Chapter.findByIdAndDelete(chapter._id);

    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================
   History
========================= */

app.get("/history/:chapterId", auth, async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.chapterId);

    if (!chapter) {
      return res.status(404).json({
        message: "chapter not found",
      });
    }

    const article = await Article.findOne({
      _id: chapter.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    const list = await Version.find({
      chapterId: req.params.chapterId,
    }).sort({
      time: -1,
    });

    res.json(list);
  } catch (err) {
    console.log("history error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

app.post("/history/:id", auth, async (req, res) => {
  try {
    const v = await Version.findById(req.params.id);

    const chapter = await Chapter.findById(v.chapterId);

    const article = await Article.findOne({
      _id: chapter.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    const updated = await Version.findByIdAndUpdate(
      req.params.id,

      {
        title: req.body.title,
      },

      {
        returnDocument: "after",
      },
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

app.put("/history/:id", auth, async (req, res) => {
  try {
    const v = await Version.findById(req.params.id);

    const chapter = await Chapter.findById(v.chapterId);

    const article = await Article.findOne({
      _id: chapter.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    let msg = req.body.message.trim();

    if (v.isRestore) {
      const oldMessage = v.message.replace("restore:", "").trim();

      msg = `${msg}（restore:${oldMessage}）`;
    }

    const updated = await Version.findByIdAndUpdate(
      req.params.id,

      {
        message: msg,
      },

      {
        returnDocument: "after",
      },
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================
   Restore
========================= */

app.post("/restore/:versionId", auth, async (req, res) => {
  try {
    const version = await Version.findById(req.params.versionId);

    if (!version) {
      return res.status(404).json({
        message: "version not found",
      });
    }

    const chapter = await Chapter.findById(version.chapterId);

    const article = await Article.findOne({
      _id: chapter.articleId,

      userId: req.userId,
    });

    if (!article) {
      return res.status(403).json({
        message: "forbidden",
      });
    }

    if (version.isRestore) {
      return res.status(400).json({
        message: "restore version cannot restore again",
      });
    }

    await Chapter.findByIdAndUpdate(
      version.chapterId,

      {
        content: version.content,

        title: version.title,
      },
    );

    await Version.create({
      chapterId: version.chapterId,

      title: version.title,

      content: version.content,

      message: `restore: ${version.message}`,

      time: new Date(),

      isRestore: true,
    });

    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================
   upload
========================= */

app.use("/uploads", express.static("uploads"));

app.post("/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "no file uploaded",
      });
    }

    const url = `http://localhost:5000/uploads/${req.file.filename}`;

    res.json({ url });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "upload failed",
    });
  }
});

/* =========================
   listen
========================= */

app.listen(5000, () => {
  console.log("server running on 5000");
});
