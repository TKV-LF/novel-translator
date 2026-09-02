# Build a Chinese-to-Vietnamese Web Novel Translator Desktop App

## Overview
Build a web application. The app translates Chinese web novels to Vietnamese page-by-page using the **DeepSeek API**. The core requirement is preserving the novel's literary style (wuxia, xianxia, urban romance, military, etc.) — never word-by-word translation.

## Tech Stack (Strict)
- **API**: DeepSeek Chat API (OpenAI-compatible format)
- **Package Manager**: pnpm

## Core Features

### 1. Novel Reader & Translator (Main Screen)
- **Input methods**: 2 option toggle. 
  - Paste raw text into a textarea
  - Paste a novel chapter URL (backend uses a simple scraper to fetch content)
- **"Translate Page" button**: Sends the current page content to DeepSeek API

### 2. Genre-Aware Translation System
- A dropdown selector at the top: `Kiếm Hiệp` | `Tu Tiên` | `Đô Thị` | `Ngôn Tình` | `Huyền Huyễn` | `Lịch Sử`
- Each genre loads a different **System Prompt** 
- The system prompt MUST instruct DeepSeek to:
  - Translate by context/paragraph, NEVER word-by-word
  - Preserve xưng hô (tiền bối, đạo hữu, lão phu, sư huynh, tổng tài, etc.)
  - Use standard Vietnamese wuxia/xianxia terminology (Đan điền, Nguyên Anh, Hóa Thần, Trúc Cơ, Kim Đan, linh khí, pháp bảo, công pháp)
  - Keep character names in Hán Việt for historical/xianxia, Pinyin for modern/urban
  - Maintain the narrative tone (heroic for wuxia, soft for romance, modern for urban)
  - Preserve 4-character idioms as poetic Vietnamese phrases
  - Return ONLY the translation, no explanations, no markdown formatting

### 3. Glossary (Thuật Ngữ) Manager
- **Auto-extraction**: After each translation, automatically call DeepSeek with a secondary prompt to extract new terms/characters/locations/skills from the translated text. Store them in SQLite.
- **Prepend to Prompt**: Before every API call, prepend the glossary entries that have appeared so far in the current novel to the system prompt. This ensures consistency across chapters.
- **Manual Edit**: User can add, edit, delete glossary entries. Changes apply immediately to future translations.

### 4. DeepSeek API Integration (Backend)
- **Endpoint**: `https://api.deepseek.com/v1/chat/completions`
- **Model**: `deepseek-chat` (or `deepseek-reasoner` if user toggles "Deep Think" mode)
- **Parameters**:
  - `temperature`: 0.3 (low creativity for consistent translation)
  - `max_tokens`: 8192
  - `thinking`: DISABLED by default (save tokens). Add a toggle in UI to enable thinking mode for difficult passages.
- **Cost optimization**:
  - Chunk long pages into ~3000-token segments
  - Cache the system prompt + glossary to minimize repeated context
  - Track API usage (input/output tokens) per translation and display estimated cost
- **Error handling**: Retry 2x on timeout, show user-friendly error if API key invalid/rate limited

### 5. Novel & Chapter Management
- **Novel List**: Sidebar showing all novels the user is reading. Each novel stores: title, author, genre, created_at.
- **Chapter List**: Within a novel, list all translated chapters. Click to load.
- **Auto-save**: Every translation is auto-saved to SQLite immediately.
- **Export**: Export a novel or single chapter to `.txt` (UTF-8) or `.md` format.

### 6. Settings & Configuration
- **API Key**: Input field stored securely (not plain localStorage).
- **Default Genre**: Remember last used genre.
- **Font Settings**: Adjustable font size for both Chinese and Vietnamese panes. Use a Chinese webfont (e.g., Noto Serif SC) and a Vietnamese serif font.
- **Theme**: Dark mode default (easier on eyes for long reading), light mode toggle.

## Database Schema 

```sql
-- novels
CREATE TABLE novels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  genre TEXT NOT NULL DEFAULT 'kiem_hiep',
  source_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- chapters
CREATE TABLE chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER,
  title TEXT,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- glossary
CREATE TABLE glossary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  translated TEXT NOT NULL,
  type TEXT CHECK(type IN ('character','term','location','skill','sect','item','other')),
  first_chapter_id INTEGER REFERENCES chapters(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- system_prompts (editable by genre)
CREATE TABLE system_prompts (
  genre TEXT PRIMARY KEY,
  prompt_text TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- api_usage
CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


Default System Prompts (Seed Data)
Insert these into system_prompts table on first run:
Genre: kiem_hiep (Wuxia)
plain
Bạn là dịch giả chuyên nghiệp tiểu thuyết kiếm hiệp Trung Quốc sang tiếng Việt.
Thể loại: Kiếm hiệp / Võ hiệp.

QUY TẮC TUYỆT ĐỐI:
1. Dịch theo NGỮ CẢNH TOÀN ĐOẠN. KHÔNG BAO GIỜ dịch word-by-word.
2. Giữ nhịp điệu văn chương hùng tráng, bi tráng của kiếm hiệp.
3. Xưng hô bắt buộc:
   - 小子 → tiểu tử
   - 前辈 → tiền bối
   - 道友 → đạo hữu
   - 老夫 → lão phu
   - 师兄/师弟 → sư huynh / sư đệ
   - 掌门 → chưởng môn
   - 师父 → sư phụ
   - 师尊 → sư tôn
4. Thuật ngữ võ học / tu chân (giữ chuẩn):
   - 丹田 → Đan điền
   - 元婴 → Nguyên Anh
   - 化神 → Hóa Thần
   - 灵气 → linh khí
   - 法宝 → pháp bảo
   - 功法 → công pháp
   - 境界 → cảnh giới
   - 筑基 → Trúc Cơ
   - 金丹 → Kim Đan
   - 元婴期 → cảnh giới Nguyên Anh
   - 飞剑 → phi kiếm
   - 内力 → nội lực
   - 真气 → chân khí
5. Tên nhân vật: Dùng Hán Việt (ví dụ: Lâm Bình Chi, Nhạc Bất Quần).
6. Thành ngữ 4 chữ: Dịch sát nghĩa nhưng giữ hình ảnh thơ (ví dụ: 飞花摘叶 → phi hoa thử diệp).
7. KHÔNG giải thích, KHÔNG thêm bình luận, KHÔNG dùng markdown. Chỉ trả về bản dịch thuần túy.
8. Giữ nguyên cấu trúc đoạn văn, xuống dòng hội thoại như bản gốc.

Genre: do_thi (Urban/Modern)
plain
Bạn là dịch giả tiểu thuyết đô thị hiện đại Trung Quốc sang tiếng Việt.
Thể loại: Đô thị / Ngôn tình hiện đại.

QUY TẮC TUYỆT ĐỐI:
1. Dịch tự nhiên, lời văn hiện đại, gần gũi. KHÔNG dùng văn phong cổ trang.
2. Xưng hô:
   - 先生 → Tiên sinh
   - 小姐 → tiểu thư
   - 老公 → lão công
   - 老婆 → lão bà
   - 总裁 → tổng tài
   - 秘书 → thư ký
   - 医生 → bác sĩ
3. Tên nhân vật: Dùng Hán Việt (ví dụ: Hoàng Văn Hoan, Hồ Phi Vũ).
4. Giữ tinh thần "sủng" → cưng chiều, nuông chiều.
5. Giữ tinh thần "虐" → đau khổ, dằn vặt.
6. KHÔNG giải thích, KHÔNG thêm bình luận. Chỉ trả về bản dịch.

Genre: tu_tien (Xianxia)
plain
Bạn là dịch giả tiểu thuyết tu tiên Trung Quốc sang tiếng Việt.
Thể loại: Tu tiên / Huyền huyễn.

QUY TẮC TUYỆT ĐỐI:
1. Dịch theo NGỮ CẢNH TOÀN ĐOẠN. KHÔNG BAO GIỜ dịch word-by-word.
2. Văn phong huyền ảo, hùng vĩ, mang tính triết lý tu đạo.
3. Xưng hô tu chân:
   - 道友 → đạo hữu
   - 前辈 → tiền bối
   - 晚辈 → hậu bối
   - 老祖 → lão tổ
   - 宗主 → tông chủ
   - 长老 → trưởng lão
   - 弟子 → đệ tử
   - 真君 → chân quân
   - 仙尊 → tiên tôn
4. Thuật ngữ tu chân (bắt buộc giữ chuẩn):
   - 筑基 → Trúc Cơ
   - 金丹 → Kim Đan
   - 元婴 → Nguyên Anh
   - 化神 → Hóa Thần
   - 炼虚 → Luyện Hư
   - 合体 → Hợp Thể
   - 大乘 → Đại Thừa
   - 渡劫 → Độ Kiếp
   - 飞升 → phi thăng
   - 仙界 → tiên giới
   - 凡界 → phàm giới
   - 灵根 → linh căn
   - 天劫 → thiên kiếp
   - 心魔 → tâm ma
   - 洞府 → động phủ
   - 秘境 → bí cảnh
5. Tên công pháp, đan dược, pháp bảo: Dùng Hán Việt (ví dụ: Cửu Chuyển Huyền Công, Tẩy Tủy Đan).
6. KHÔNG giải thích, KHÔNG thêm bình luận. Chỉ trả về bản dịch thuần túy.


UI/UX Design Requirements
Dark theme default (slate-950 background, slate-100 text).
Main layout:
Top bar: App title | Genre Selector | "New Novel" button | Settings icon
Left sidebar (collapsible): Novel list → Chapter list
Center: Split-pane reader (resizable divider)
Right sidebar (collapsible): Glossary table
Translation flow:
User pastes text → clicks "Dịch Trang" → shows loading spinner → displays Vietnamese text
Highlight the paragraph currently being hovered on both sides
Glossary sidebar:
Search/filter by type
Inline edit (double-click to edit)
"Add Term" floating button
Empty states: Show friendly illustrations when no novel is selected.
File Structure
plain
src/
├── components/
│   ├── Reader/
│   │   ├── SplitPane.tsx
│   │   ├── ChinesePane.tsx
│   │   ├── VietnamesePane.tsx
│   │   └── ScrollSync.tsx
│   ├── Sidebar/
│   │   ├── NovelList.tsx
│   │   ├── ChapterList.tsx
│   │   └── GlossaryPanel.tsx
│   ├── Translation/
│   │   ├── GenreSelector.tsx
│   │   ├── TranslateButton.tsx
│   │   └── TranslationProgress.tsx
│   └── ui/ (shadcn components)
├── hooks/
│   ├── useNovel.ts
│   ├── useTranslation.ts
│   └── useGlossary.ts
├── stores/
│   └── novelStore.ts (Zustand)
├── types/
│   └── index.ts
└── App.tsx

src-server/
