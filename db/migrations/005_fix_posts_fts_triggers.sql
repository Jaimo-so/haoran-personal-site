-- 修复 FTS5 external-content 表的同步触发器。
-- external-content 模式不应直接 UPDATE / DELETE 虚拟表，
-- 需要用 FTS5 delete 指令删除旧索引，再写入新索引。

BEGIN;

DROP TRIGGER IF EXISTS posts_ai;
DROP TRIGGER IF EXISTS posts_au;
DROP TRIGGER IF EXISTS posts_ad;

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, content)
  VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content)
  VALUES ('delete', old.id, old.title, old.content);
  INSERT INTO posts_fts(rowid, title, content)
  VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content)
  VALUES ('delete', old.id, old.title, old.content);
END;

INSERT INTO posts_fts(posts_fts) VALUES ('rebuild');

COMMIT;
