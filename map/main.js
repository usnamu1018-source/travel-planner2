// main.js

let map;
let marker = null;
let geocoder;
let selectedPlace = null;

// ----------------------
// 지도 초기화 함수
// ----------------------
function initMap() {
  // 지도를 서울 중심에 초기화
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 37.5665, lng: 126.9780 },
    zoom: 13,
  });

  geocoder = new google.maps.Geocoder();

  // 클릭 이벤트
  map.addListener("click", (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    // 기존 마커 제거
    if (marker) marker.setMap(null);

    // 새 마커 생성
    marker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
    });

    // 역지오코딩: 클릭 위치의 주소 얻기
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        const address = results[0].formatted_address;

        selectedPlace = {
          lat,
          lng,
          name: address
        };

        document.getElementById("placeInfo").innerText = address;
        document.getElementById("generateBtn").disabled = false;

      } else {
        selectedPlace = {
          lat,
          lng,
          name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        };

        document.getElementById("placeInfo").innerText = selectedPlace.name;
        document.getElementById("generateBtn").disabled = false;
      }
    });
  });
}

// 전역에서 호출되도록 window에 등록
window.initMap = initMap;

// ----------------------
// AI 일정 생성 요청
// ----------------------
document.getElementById("generateBtn").addEventListener("click", async () => {
  if (!selectedPlace) return;

  const itDiv = document.getElementById("itinerary");
  itDiv.innerText = "AI가 일정을 생성하는 중입니다...";

  try {
    // 실제 배포 시: https://YOUR_SERVER/api/generate 로 변경
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place: selectedPlace }),
    });

    if (!resp.ok) throw new Error("서버 오류: " + resp.status);

    const data = await resp.json();
    itDiv.innerText = data.itinerary;
  } catch (err) {
    itDiv.innerText = "오류 발생: " + err.message;
  }
});
