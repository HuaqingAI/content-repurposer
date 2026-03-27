/**
 * Mock SSE 端点 - 用于开发流式渲染组件
 * 模拟真实 SSE 协议，按 architecture.md 定义的格式推送事件
 */

export const runtime = "edge";

const MOCK_CONTENT_XIAOHONGSHU = `今天来分享一个超实用的内容创作技巧！🌟

很多人在做内容的时候都会遇到一个困境：明明有很多想法，但就是写不出来。

其实问题不在于你没有想法，而在于你没有找到正确的输出方式。

分享三个我亲测有效的方法：

1. 先列大纲再写正文，思路会清晰很多
2. 用口语化的表达，让读者感觉在和朋友聊天
3. 结尾一定要有互动引导，增加评论率

学会这些，你的内容质量会有质的飞跃！`;

const MOCK_CONTENT_WEIBO = `内容创作三大秘诀：1️⃣先列大纲理清思路；2️⃣口语化表达拉近距离；3️⃣结尾互动提升评论率。学会了吗？转发收藏备用！`;

function encodeSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function* generateStream(): AsyncGenerator<string> {
  // 平台1：小红书
  yield encodeSSE("platform_start", { platform: "xiaohongshu" });
  await sleep(200);

  const chunks = splitIntoChunks(MOCK_CONTENT_XIAOHONGSHU, 8);
  for (const chunk of chunks) {
    yield encodeSSE("chunk", { text: chunk });
    await sleep(100);
  }

  yield encodeSSE("titles", {
    titles: [
      "3个技巧让你的内容创作效率翻倍",
      "写不出内容？可能是方法错了",
      "内容创作新手必看：从0到1的实战指南",
    ],
  });
  await sleep(150);

  yield encodeSSE("tags", {
    tags: ["内容创作", "写作技巧", "小红书运营", "自媒体", "干货分享"],
  });
  await sleep(150);

  yield encodeSSE("hook", { hook: "你在内容创作中遇到过哪些困境？评论区聊聊～" });
  await sleep(150);

  yield encodeSSE("platform_complete", {
    platform: "xiaohongshu",
    tokens_used: 856,
    cost_cents: 6,
  });
  await sleep(300);

  // 平台2：微博
  yield encodeSSE("platform_start", { platform: "weibo" });
  await sleep(200);

  const weiboChunks = splitIntoChunks(MOCK_CONTENT_WEIBO, 10);
  for (const chunk of weiboChunks) {
    yield encodeSSE("chunk", { text: chunk });
    await sleep(80);
  }

  yield encodeSSE("tags", {
    tags: ["内容创作", "写作", "自媒体运营"],
  });
  await sleep(150);

  yield encodeSSE("platform_complete", {
    platform: "weibo",
    tokens_used: 312,
    cost_cents: 2,
  });
  await sleep(200);

  // 全部完成
  yield encodeSSE("done", { record_id: "mock-record-" + Date.now() });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generateStream()) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const errorMsg = encodeSSE("error", {
          message: err instanceof Error ? err.message : "未知错误",
          retryable: false,
        });
        controller.enqueue(encoder.encode(errorMsg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET() {
  return POST();
}
