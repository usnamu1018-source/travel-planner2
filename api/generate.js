// api/generate.js
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const { place } = req.body;
  if (!place) return res.status(400).json({ error: "place is required" });

  const prompt = `
당신은 전문 여행 컨설턴트이자 일정 플래너입니다.
사용자가 선택한 장소는 다음과 같습니다:

- 장소명: ${place.name}
- 위도: ${place.lat}
- 경도: ${place.lng}

요청사항:
이 장소를 중심으로 '현실적으로 가능한 1일 여행 일정'을 아주 자세하게 만들어줘.
다음 요소를 반드시 포함해줘:
- 1시간 단위로 나누어진 일정표 (시작/종료시간 포함)
- 장소별 이동수단(도보/버스/지하철/택시)과 예상 이동시간
- 입장료, 소요시간
- 음식점 추천(메뉴, 가격대)
- 안전 팁 / 간단한 준비물
- 비가 올 경우 대체 일정까지

한국어로 친절하게 작성해줘.
`;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "No API KEY" });

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
      }),
    });

    const j = await aiResponse.json();
    const text = j.choices?.[0]?.message?.content ?? "AI 응답 없음";

    return res.json({ itinerary: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
