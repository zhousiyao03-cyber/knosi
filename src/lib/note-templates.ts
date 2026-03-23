export function formatJournalTitle(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function createJournalTemplate(date = new Date()) {
  const title = formatJournalTitle(date);
  const content = JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "今日日记" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "今天最值得记录的一件事是：" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Todo List" }],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "今天最重要的一件事" }],
              },
            ],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "一个让我开心的小瞬间" }],
              },
            ],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "睡前想完成的收尾" }],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "复盘" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "今天学到了什么？" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "明天想延续什么？" }],
              },
            ],
          },
        ],
      },
    ],
  });
  const plainText = [
    "今日日记",
    "今天最值得记录的一件事是：",
    "Todo List",
    "今天最重要的一件事",
    "一个让我开心的小瞬间",
    "睡前想完成的收尾",
    "复盘",
    "今天学到了什么？",
    "明天想延续什么？",
  ].join("\n");

  return {
    title,
    type: "journal" as const,
    content,
    plainText,
  };
}
