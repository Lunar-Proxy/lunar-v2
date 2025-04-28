const aiSec = "AIzaSyCFE21SCT6RlObXmvzOAHlhlKYYDlV8G1c"; // do not steal or ur a bad person >:(
const Api = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiSec}`;

const input = document.getElementById('responseinp') as HTMLInputElement | null;
const attach = document.getElementById('attach') as HTMLElement | null;
const attachInput = document.getElementById('imageInput') as HTMLInputElement | null;
const attachImg = document.getElementById('attachimg') as HTMLImageElement | null;
const conversation = document.getElementById('conversation') as HTMLElement | null;
const categoriesDiv = document.getElementById('categories') as HTMLElement | null;
const categoryBtns = document.querySelectorAll('.categoryBtn') as NodeListOf<HTMLButtonElement>;
const deleteBtn = document.getElementById('del') as HTMLButtonElement | null;

let attachedImage: string | null = null;
let chatHistory: { role: string; parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] }[] = [];
if (attach && attachInput) {
  attach.addEventListener('click', () => attachInput.click());
  attachInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const file = target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        attachedImage = e.target?.result as string | null;
        if (attachImg && attachedImage) {
          attachImg.src = attachedImage;
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

categoryBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (categoriesDiv) {
      categoriesDiv.classList.add('hidden');
    }
    conversation?.classList.remove('hidden');
    if (input) {
      input.value = btn.dataset.text || '';
      input.focus();
      const userText = input.value.trim();
      if (userText) {
        input.value = '';
        addMessage('user', userText, null);
        chatHistory.push({ role: 'user', parts: [{ text: userText }] });
        const typingBubble = addMessage('bot', 'typing');
        await fetchAI(typingBubble);
      }
    }
  });
});

input?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && input.value.trim()) {
    if (categoriesDiv) {
      categoriesDiv.classList.add('hidden');
    }
    conversation?.classList.remove('hidden');
    const userText = input.value.trim();
    input.value = '';
    addMessage('user', userText, attachedImage);
    chatHistory.push({ role: 'user', parts: [{ text: userText }] });
    if (attachedImage) {
      chatHistory.push({ role: 'user', parts: [{ inline_data: { mime_type: "image/png", data: attachedImage.split(',')[1] } }] });
    }
    const typingBubble = addMessage('bot', 'typing');
    await fetchAI(typingBubble);
    attachedImage = null;
    if (attachInput) attachInput.value = '';
    if (attachImg) attachImg.src = "/a/images/logo/up.svg";
  }
});

async function fetchAI(typingBubble: HTMLElement) {
  try {
    const res = await fetch(Api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: chatHistory })
    });
    const data = await res.json();
    const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No reply.';
    updateMessage(typingBubble, botReply);
    chatHistory.push({ role: 'model', parts: [{ text: botReply }] });
  } catch (err) {
    updateMessage(typingBubble, 'Error: Failed to fetch from Gemini.');
  }
}

function addMessage(sender: 'user' | 'bot', text: string, image: string | null = null): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;
  const bubble = document.createElement('div');
  bubble.className = `relative max-w-xs p-4 rounded-2xl ${sender === 'user' ? 'bg-blue-600 text-white' : 'bg-background-overlay text-text-header'} shadow-md space-y-2 whitespace-pre-wrap`;
  const msg = document.createElement('p');
  if (text === 'typing') {
    let dots = 1;
    msg.textContent = ".";
    const interval = setInterval(() => {
      dots = (dots % 3) + 1;
      msg.textContent = ".".repeat(dots);
    }, 500);
    (bubble as any).dataset.typingInterval = interval;
  } else {
    msg.textContent = text;
  }
  bubble.appendChild(msg);
  if (image && sender === 'user') {
    const imgPreview = document.createElement('img');
    imgPreview.src = image;
    imgPreview.alt = "uploaded image";
    imgPreview.className = "mt-2 rounded-lg max-h-40 object-cover";
    bubble.appendChild(imgPreview);
  }
  if (sender === 'bot') {
    const regenBtn = document.createElement('button');
    regenBtn.textContent = "↻";
    regenBtn.className = "absolute top-2 right-2 text-xs bg-background-overlay p-1 rounded-full hover:scale-110 transition";
    regenBtn.onclick = async () => {
      bubble.innerHTML = "";
      const regenTyping = document.createElement('p');
      regenTyping.textContent = "...";
      bubble.appendChild(regenTyping);
      await fetchAI(bubble);
    };
    bubble.appendChild(regenBtn);
  }
  wrapper.appendChild(bubble);
  conversation?.appendChild(wrapper);
  conversation?.scrollTo(0, conversation.scrollHeight);
  return bubble;
}

function updateMessage(bubble: HTMLElement, newText: string) {
  if ((bubble as any).dataset.typingInterval) {
    clearInterval((bubble as any).dataset.typingInterval);
    delete (bubble as any).dataset.typingInterval;
  }
  const htmlContent = parseMarkdown(newText);
  bubble.innerHTML = `<p>${htmlContent}</p>`;
  conversation?.scrollTo(0, conversation.scrollHeight);
}

function parseMarkdown(text: string): string {
  text = text.replace(/(\*\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  text = text.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
  text = text.replace(/`(.*?)`/g, '<code class="bg-gray-800 text-white p-1 rounded-md">$1</code>');
  text = text.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-4 rounded-md"><code>$1</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-white p-1 rounded-md">$1</code>');
  return text;
}

deleteBtn?.addEventListener('click', () => {
  chatHistory = [];
  conversation?.classList.add('hidden');
  if (conversation) conversation.innerHTML = '';
  categoriesDiv?.classList.remove('hidden');
});
