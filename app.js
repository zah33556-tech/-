const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const chat = document.querySelector("#chat");
const statusCopy = document.querySelector("#status-copy");
const urgency = document.querySelector("#urgency");
const possibilities = document.querySelector("#possibilities");
const nextSteps = document.querySelector("#next-steps");
const careGuidance = document.querySelector("#care-guidance");
const professionalCare = document.querySelector("#professional-care");
const careLabel = document.querySelector("#care-label");
const careSpecialist = document.querySelector("#care-specialist");
const assessmentMark = document.querySelector("#assessment-mark");
const severityChart = document.querySelector("#severity-chart");
const severityValue = document.querySelector("#severity-value");
const severityNote = document.querySelector("#severity-note");
const carePath = document.querySelector("#care-path");
const routeBadge = document.querySelector("#route-badge");
const apiStatus = document.querySelector("#api-status");
const connectionHint = document.querySelector("#connection-hint");
const keyDialog = document.querySelector("#key-dialog");
const keyForm = document.querySelector("#key-form");
const keyInput = document.querySelector("#api-key-input");
const keyError = document.querySelector("#key-error");
const forgetKey = document.querySelector("#forget-key");

const LOCAL_API_KEY = "AIzaSyCYrihFMBxmd7tXk1Hd--jw5ornuMNVJqo";
const API_KEY_STORAGE = "afiya.geminiKey";
const MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"];
const conversation = [];
let isSending = false;
let assessmentCompleted = false;
let apiKey = LOCAL_API_KEY || readSavedKey();

function readSavedKey() {
  try {
    return sessionStorage.getItem(API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

function updateConnectionState() {
  const connected = Boolean(apiKey);
  apiStatus.innerHTML = `<span class="status-dot${connected ? " connected" : ""}"></span>${
    connected ? "المساعد متصل" : "جاهز للبدء"
  }`;
  connectionHint.hidden = connected;
  forgetKey.hidden = !connected;
}

function openKeySettings() {
  keyError.hidden = true;
  keyError.textContent = "";
  keyInput.value = apiKey;
  keyDialog.showModal();
  keyInput.focus();
}

function addMessage(role, text) {
  const message = document.createElement("article");
  message.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "أنت" : "عافية";
  const body = document.createElement("p");
  body.textContent = text;
  message.append(label, body);
  chat.append(message);
  scrollChatToBottom();
  return body;
}

function scrollChatToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

async function typeAssistantMessage(text) {
  const body = addMessage("assistant", "");
  const segments = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter("ar", { granularity: "grapheme" }).segment(text)].map((part) => part.segment)
    : Array.from(text);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chunkSize = reducedMotion ? segments.length : 2;
  const delay = reducedMotion ? 0 : 18;

  for (let index = 0; index < segments.length; index += chunkSize) {
    body.textContent += segments.slice(index, index + chunkSize).join("");
    scrollChatToBottom();
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
  }
}

function setList(element, values, emptyText) {
  element.replaceChildren();
  element.classList.toggle("empty-list", !values.length);
  for (const value of values.length ? values : [emptyText]) {
    const item = document.createElement("li");
    item.textContent = value;
    element.append(item);
  }
}

function updateDashboard(result) {
  statusCopy.textContent = result.summary;
  const urgencyLabels = {
    unknown: "بانتظار التفاصيل",
    routine: "متابعة منزلية مبدئيًا",
    soon: "يُفضّل استشارة طبيب قريبًا",
    urgent: "اطلب رعاية طبية عاجلة",
  };
  urgency.dataset.level = result.urgency;
  urgency.textContent = urgencyLabels[result.urgency];
  setList(possibilities, result.possibilities, "لسه محتاجين تفاصيل أكتر عشان نذكر احتمالات مفيدة.");
  setList(nextSteps, result.nextSteps, "كمّل الإجابة على أسئلة عافية عشان نحدد خطوات مناسبة.");

  const careLabels = {
    unknown: "لسه بنجمع معلومات",
    home: "رعاية منزلية ومتابعة",
    pharmacist: "استشارة صيدلي",
    doctor: "مراجعة طبيب",
    emergency: "طوارئ فورًا",
  };
  careGuidance.textContent = result.treatment || (
    result.assessmentComplete
      ? "اتبع الخطوات المذكورة، وراجع الصيدلي أو الطبيب قبل استخدام أي دواء."
      : "لسه بجمع تفاصيل مهمة عشان أقدر أوجّهك بأمان."
  );
  careLabel.textContent = careLabels[result.careLevel];
  careSpecialist.textContent = result.specialist;
  professionalCare.hidden = result.careLevel === "unknown" || result.careLevel === "home";
  updateSeverityChart(result);
  updateCarePath(result);
  assessmentMark.textContent = result.assessmentComplete ? "✓" : "+";
  assessmentMark.classList.toggle("assessment-complete", result.assessmentComplete);

  if (result.assessmentComplete) {
    assessmentCompleted = true;
    input.disabled = true;
    input.placeholder = "اكتمل التقييم المبدئي";
    sendButton.disabled = true;
    sendButton.textContent = "تم";
    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.disabled = true;
    });
  }
}

function updateSeverityChart(result) {
  const hasScore = result.severityReported && Number.isInteger(result.severityScore);
  severityChart.dataset.hasScore = String(hasScore);
  if (!hasScore) {
    severityValue.innerHTML = '—<small>/ 10</small>';
    severityNote.textContent = "لو حابب، قيّم شدة العرض من 0 إلى 10 عشان نعرضه هنا.";
    severityChart.setAttribute("aria-label", "لم يتم تسجيل تقييم ذاتي لشدة العرض بعد");
    return;
  }

  const score = Math.max(0, Math.min(10, result.severityScore));
  severityChart.style.setProperty("--severity-progress", `${score * 10}%`);
  severityValue.innerHTML = `${score}<small>/ 10</small>`;
  severityNote.textContent = "ده تقييمك الشخصي لشدة العرض، مش مقياس تشخيصي.";
  severityChart.setAttribute("aria-label", `تقييمك الشخصي لشدة العرض ${score} من 10`);
}

function updateCarePath(result) {
  const level = result.careLevel;
  const labels = {
    unknown: "لسه بنقيّم",
    home: "رعاية منزلية",
    pharmacist: "استشارة صيدلي",
    doctor: "مراجعة طبيب",
    emergency: "طوارئ فورًا",
  };
  const selectedStep = level === "emergency" ? "emergency" : level;
  carePath.dataset.level = level;
  carePath.setAttribute("aria-label", `مسار الرعاية المقترح: ${labels[level]}`);
  routeBadge.textContent = labels[level];
  carePath.querySelectorAll(".route-step").forEach((step) => {
    step.classList.toggle("is-current", step.dataset.step === selectedStep);
  });
}

function friendlyApiError(status, details) {
  const message = details?.error?.message || "";
  if (status === 400 || status === 403) {
    return "مفتاح Gemini غير مقبول أو صلاحياته غير مفعّلة. راجع مفتاح Google AI Studio.";
  }
  if (status === 404) {
    return "نموذج Gemini غير متاح لهذا المفتاح. تأكد من إعداد النموذج أو حدّث الصفحة.";
  }
  if (status === 429) {
    return "وصلت لحد الاستخدام المؤقت لـ Gemini. استنى شوية وجرب تاني.";
  }
  if (status === 503 || status === 504) {
    return "Gemini مشغول حاليًا. استنى ثواني وجرب تاني.";
  }
  if (/API key not valid|API_KEY_INVALID/i.test(message)) {
    return "مفتاح Gemini غير صالح. راجعه في إعداد الاتصال.";
  }
  return "حصلت مشكلة في الاتصال بـ Gemini. حاول مرة تانية بعد قليل.";
}

function parseAssistantResult(payload) {
  const candidate = payload.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("INVALID_MODEL_JSON");
  }

  const responseText = candidate?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!responseText) throw new Error("INVALID_MODEL_JSON");

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    const firstBrace = responseText.indexOf("{");
    const lastBrace = responseText.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error("INVALID_MODEL_JSON");
    }
    try {
      result = JSON.parse(responseText.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error("INVALID_MODEL_JSON");
    }
  }

  const valid =
    result &&
    typeof result.reply === "string" &&
    typeof result.summary === "string" &&
    ["unknown", "routine", "soon", "urgent"].includes(result.urgency) &&
    typeof result.assessmentComplete === "boolean" &&
    ["unknown", "home", "pharmacist", "doctor", "emergency"].includes(result.careLevel) &&
    typeof result.specialist === "string" &&
    typeof result.treatment === "string" &&
    typeof result.severityReported === "boolean" &&
    Number.isInteger(result.severityScore) &&
    result.severityScore >= 0 &&
    result.severityScore <= 10 &&
    Array.isArray(result.possibilities) &&
    result.possibilities.every((item) => typeof item === "string") &&
    Array.isArray(result.nextSteps) &&
    result.nextSteps.every((item) => typeof item === "string");

  if (!valid) throw new Error("INVALID_MODEL_JSON");
  return result;
}

async function requestGemini(models, requestBody, signal) {
  let lastResponse;

  for (const [index, model] of models.entries()) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal,
      },
    );
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.ok) return { payload, model };

    lastResponse = { status: response.status, payload: payload || {} };
    const canTryAnotherModel = [404, 429, 500, 502, 503, 504].includes(response.status);
    if (!canTryAnotherModel || index === models.length - 1) {
      throw new Error(friendlyApiError(response.status, payload || {}));
    }
    console.warn(`Gemini model ${model} returned HTTP ${response.status}; trying a fallback model.`);
  }

  throw new Error(friendlyApiError(lastResponse.status, lastResponse.payload));
}

async function sendMessage(text) {
  if (isSending || !text.trim()) return;
  if (!apiKey) {
    openKeySettings();
    return;
  }

  isSending = true;
  sendButton.disabled = true;
  input.disabled = true;
  addMessage("user", text);
  conversation.push({ role: "user", parts: [{ text }] });

  const typing = document.createElement("p");
  typing.className = "typing";
  typing.innerHTML = '<span>عافية بتراجع كلامك</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  chat.append(typing);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 35_000);

  try {
    const requestBody = {
        systemInstruction: {
          parts: [
            {
              text: [
                "أنت عافية، مساعد تثقيف صحي أولي تتحدث بلهجة مصرية طبيعية ودودة ومختصرة. اسمع كويس ورد كأنك شخص هادي ومهتم.",
                "اجمع التاريخ المرضي بأسئلة متابعة ذكية واحدًا في كل مرة: العرض الأساسي ومدته وشدته، ثم علامات الخطر والعمر والحمل والأمراض والأدوية حسب الحاجة. لا تسأل سؤالًا سبق أن أجاب عنه المستخدم. لا تنه التقييم ولا تضع احتمالات قبل جمع معلومات كافية. لا تعتبر عدم إجابة المستخدم عن سؤال علامة خطر نفيًا له، ولا تكتب في الملخص أنه لا يوجد عرض إلا إذا نفاه المستخدم صراحة.",
                "إذا لم يصف المستخدم شدة العرض وكان تقييمها مفيدًا، اسأله بلطف أن يقيّمها من 0 إلى 10. هذا تقييم شخصي فقط ولا يحدد وحده مدى الخطورة.",
                "قبل إنهاء تقييم الكحة، تأكد بسؤال مباشر أن المستخدم لا يعاني من ضيق نفس أو ألم بالصدر أو دم مع الكحة أو حرارة شديدة. إذا لم يجب عن أحدها، اسأله عنه بدل افتراض أن الإجابة لا. اسأل عن العمر والحمل والأمراض المزمنة عندما يمكن أن تغيّر التوجيه أو أمان الدواء.",
                "إذا كانت التوصية تتضمن سؤال صيدلي عن دواء، لا تنه التقييم قبل معرفة العمر والأمراض المزمنة والأدوية المؤثرة، والحمل عند صلته. إذا لم تتوفر معلومة مهمة اسأل عنها بدل افتراض الإجابة.",
                "إذا ما زالت معلومة مهمة ناقصة، خصوصًا علامة خطر مناسبة للأعراض لم يُجب عنها المستخدم: اكتب ردًا قصيرًا فيه سؤال واحد فقط، واجعل assessmentComplete=false وurgency=unknown وcareLevel=unknown، واترك القوائم والملخص موجزة.",
                "عند اكتمال المعلومات فقط، اجعل assessmentComplete=true واكتب ملخصًا محددًا يجمع الأعراض ومدتها والعلامات المهمة التي نفاها المستخدم. اعرض بحد أقصى 3 احتمالات عامة بصيغة غير جازمة، ووضح أنها ليست تشخيصًا.",
                "قدّم علاجًا داعمًا آمنًا ومحددًا للحالة في treatment وnextSteps، مثل الراحة والسوائل أو قياس الحرارة ومتى يعيد التقييم. لا تصف دواءً أو جرعة ولا تقترح مضادًا حيويًا أو إيقاف دواء. إذا سأل عن دواء دون وصفة فوجّهه للصيدلي ليسأل عن المناسب بعد مراجعة العمر والحساسية والحمل والأمراض والأدوية.",
                "اختر careLevel=home إذا كانت العناية المنزلية كافية، أو pharmacist إذا كان يحتاج سؤال صيدلي عن دواء، أو doctor إذا احتاج فحصًا طبيًا. عند doctor اذكر في specialist التخصص الطبي المناسب وسبب المراجعة والوقت المناسب بوضوح. لا تحوّل كل حالة إلى الطبيب.",
                "إذا ذكر صعوبة تنفس شديدة أو ألم صدر شديد أو إغماء أو ارتباك أو نزيف شديد، اجعل urgency=urgent وcareLevel=emergency وassessmentComplete=true، ووجّهه للطوارئ فورًا دون مواصلة الاستجواب.",
                "في نهاية التقييم النهائي، اجعل reply قصيرة وطبيعية فقط، مثل: أهم نصيحة أو التوجيه للطبيب. ستضيف الواجهة رسالة ختام منفصلة. لا تستخدم تشخيصًا قطعيًا.",
                "severityReported=true وseverityScore من 0 إلى 10 فقط إذا ذكر المستخدم بنفسه رقمًا واضحًا لشدة العرض الحالي. إذا لم يذكر رقمًا، اجعل severityReported=false وseverityScore=0، ولا تخمن الرقم من وصفه. احتفظ بآخر تقييم رقمي صريح ذكره المستخدم في المحادثة.",
                "أعد JSON مطابقًا للمخطط فقط. اجعل reply طبيعية، summary واضحًا ومحددًا، possibilities قائمة، nextSteps خطوات مرقمة كنصوص قصيرة.",
              ].join(" "),
            },
          ],
        },
        contents: conversation.slice(-8),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              reply: { type: "STRING" },
              summary: { type: "STRING" },
              urgency: {
                type: "STRING",
                enum: ["unknown", "routine", "soon", "urgent"],
              },
              assessmentComplete: { type: "BOOLEAN" },
              careLevel: {
                type: "STRING",
                enum: ["unknown", "home", "pharmacist", "doctor", "emergency"],
              },
              specialist: { type: "STRING" },
              treatment: { type: "STRING" },
              severityReported: { type: "BOOLEAN" },
              severityScore: { type: "INTEGER", minimum: 0, maximum: 10 },
              possibilities: { type: "ARRAY", items: { type: "STRING" } },
              nextSteps: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: [
              "reply",
              "summary",
              "urgency",
              "assessmentComplete",
              "careLevel",
              "specialist",
              "treatment",
              "severityReported",
              "severityScore",
              "possibilities",
              "nextSteps",
            ],
          },
          temperature: 0.55,
          maxOutputTokens: 650,
        },
    };
    const firstResponse = await requestGemini(MODELS, requestBody, controller.signal);
    let result;
    try {
      result = parseAssistantResult(firstResponse.payload);
    } catch (error) {
      if (error.message !== "INVALID_MODEL_JSON") throw error;
      console.warn("Gemini returned incomplete JSON; retrying with a larger response budget.");
      const retryBody = JSON.parse(JSON.stringify(requestBody));
      retryBody.systemInstruction.parts[0].text +=
        " مهم: أكمل كل النصوص وأغلق JSON بالكامل قبل الإنهاء؛ أعد كائن JSON واحدًا صالحًا فقط.";
      retryBody.generationConfig.maxOutputTokens = 900;
      const fallbackModels = [
        firstResponse.model,
        ...MODELS.filter((model) => model !== firstResponse.model),
      ];
      const retryResponse = await requestGemini(fallbackModels, retryBody, controller.signal);
      try {
        result = parseAssistantResult(retryResponse.payload);
      } catch (retryError) {
        if (retryError.message !== "INVALID_MODEL_JSON") throw retryError;
        throw new Error("الرد وصل ناقص من Gemini. رسالتك محفوظة، فجرّب إرسالها مرة تانية.");
      }
    }

    conversation.push({ role: "model", parts: [{ text: JSON.stringify(result) }] });
    updateDashboard(result);
    if (result.assessmentComplete) {
      const closingMessage = result.careLevel === "emergency"
        ? "الأعراض اللي وصفتها محتاجة طوارئ فورًا. ألف سلامة عليك."
        : result.careLevel === "doctor"
          ? `الأفضل تراجع ${(result.specialist || "طبيبًا").replace(/[.،\s]+$/, "")}. ألف سلامة عليك.`
          : result.careLevel === "pharmacist"
            ? "اسأل الصيدلي عن العلاج المناسب لحالتك. ألف سلامة عليك."
          : "ألف سلامة عليك، اتبع الخطوات المكتوبة في الملخص واتمنى لك الشفاء والعافية.";
      await typeAssistantMessage(closingMessage);
    } else {
      await typeAssistantMessage(result.reply);
    }
  } catch (error) {
    conversation.pop();
    input.value = text;
    resizeComposer();
    if (error.name === "AbortError") {
      addMessage("assistant", "الرد اتأخر. جرّب تاني، أو اختصر وصف الأعراض.");
    } else if (error instanceof TypeError) {
      addMessage(
        "assistant",
        "مش قادر أوصل لـ Gemini. افتح الصفحة عبر Live Server أو موقع HTTPS، وتأكد من اتصال الإنترنت.",
      );
    } else {
      addMessage("assistant", error.message || "حصلت مشكلة غير متوقعة. جرّب تاني.");
    }
  } finally {
    window.clearTimeout(timeout);
    typing.remove();
    isSending = false;
    sendButton.disabled = assessmentCompleted;
    sendButton.textContent = assessmentCompleted ? "تم" : "إرسال";
    if (!assessmentCompleted) {
      input.disabled = false;
      input.focus();
    }
  }
}

document.querySelector("#key-settings").addEventListener("click", openKeySettings);

keyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key) {
    keyError.textContent = "اكتب مفتاح Gemini الأول.";
    keyError.hidden = false;
    return;
  }

  try {
    sessionStorage.setItem(API_KEY_STORAGE, key);
  } catch {
    keyError.textContent = "المتصفح منع حفظ المفتاح للجلسة. فعّل التخزين أو افتح الصفحة في متصفح عادي.";
    keyError.hidden = false;
    return;
  }

  apiKey = key;
  keyDialog.close();
  updateConnectionState();
  input.focus();
});

forgetKey.addEventListener("click", () => {
  try {
    sessionStorage.removeItem(API_KEY_STORAGE);
  } catch {
    apiKey = "";
  }
  apiKey = "";
  keyDialog.close();
  updateConnectionState();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (assessmentCompleted) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  resizeComposer();
  sendMessage(text);
});

function resizeComposer() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

input.addEventListener("input", resizeComposer);

input.addEventListener("keydown", (event) => {
  if (!assessmentCompleted && event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    if (assessmentCompleted) return;
    input.value = button.dataset.prompt;
    form.requestSubmit();
  });
});

updateConnectionState();
resizeComposer();
