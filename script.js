let map;
let markers = [];
let selectedPlaces = [];
let autocomplete;
let openaiApiKey = '';
let selectedTheme = 'family';
let placesService;
let geocoder;

const themeInfo = {
    family: {
        name: '가족여행',
        description: '아이들과 함께 즐길 수 있는 안전하고 편안한 여행',
        keywords: '가족 친화적, 어린이, 편의시설, 안전한'
    },
    date: {
        name: '데이트',
        description: '로맨틱하고 분위기 있는 연인과의 특별한 시간',
        keywords: '로맨틱, 분위기 좋은, 커플, 사진 명소'
    },
    friends: {
        name: '우정여행',
        description: '친구들과 함께하는 활기차고 즐거운 여행',
        keywords: '활동적, 재미있는, SNS 인증샷, 맛집'
    }
};

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
        alert('API 키를 입력해주세요.');
        return;
    }
    if (!key.startsWith('sk-')) {
        alert('올바른 OpenAI API 키 형식이 아닙니다. (sk-로 시작해야 합니다)');
        return;
    }
    openaiApiKey = key;
    document.getElementById('apiKeySetup').classList.add('hidden');
    alert('API 키가 저장되었습니다!');
    updateGenerateButton();
}

function selectTheme(theme) {
    selectedTheme = theme;
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    event.target.closest('.theme-option').classList.add('active');
}

function initMap() {
    const seoul = { lat: 37.5665, lng: 126.9780 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: seoul,
        zoom: 12,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "on" }]
            }
        ]
    });

    placesService = new google.maps.places.PlacesService(map);
    geocoder = new google.maps.Geocoder();

    map.addListener('click', function(event) {
        addPlaceByLocation(event.latLng);
    });

    const input = document.getElementById('searchInput');
    autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'kr' },
        fields: ['place_id', 'geometry', 'name', 'formatted_address', 'types']
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
            alert('장소 정보를 찾을 수 없습니다.');
            return;
        }

        addPlace(place);
        map.setCenter(place.geometry.location);
        map.setZoom(15);
        input.value = '';
    });
}

function addPlaceByLocation(latLng) {
    geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const addressParts = results[0].formatted_address.split(',');
            const placeName = addressParts[0].trim() || '선택한 위치';
            
            const placeData = {
                place_id: 'custom_' + Date.now(),
                name: placeName,
                address: results[0].formatted_address,
                geometry: {
                    location: latLng
                },
                types: ['point_of_interest']
            };
            addPlace(placeData);
        } else {
            const placeData = {
                place_id: 'custom_' + Date.now(),
                name: `선택한 위치 (${latLng.lat().toFixed(6)}, ${latLng.lng().toFixed(6)})`,
                address: `위도: ${latLng.lat().toFixed(6)}, 경도: ${latLng.lng().toFixed(6)}`,
                geometry: {
                    location: latLng
                },
                types: ['point_of_interest']
            };
            addPlace(placeData);
        }
    });
}

function addPlace(place) {
    if (selectedPlaces.find(p => p.place_id === place.place_id)) {
        alert('이미 추가된 장소입니다.');
        return;
    }

    const placeData = {
        place_id: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity || '주소 정보 없음',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        types: place.types || []
    };

    selectedPlaces.push(placeData);

    const marker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: place.name,
        animation: google.maps.Animation.DROP,
        label: {
            text: String(selectedPlaces.length),
            color: 'white',
            fontWeight: 'bold'
        }
    });

    markers.push(marker);
    updatePlacesList();
    updateGenerateButton();
}

function updatePlacesList() {
    const listContainer = document.getElementById('placesList');
    const countElement = document.getElementById('placeCount');
    
    countElement.textContent = selectedPlaces.length;
    
    listContainer.innerHTML = selectedPlaces.map((place, index) => `
        <div class="place-item">
            <span class="place-name">
                ${index + 1}. ${place.name}
                <span class="place-badge">필수</span>
            </span>
            <button class="remove-btn" onclick="removePlace(${index})">삭제</button>
        </div>
    `).join('');
}

function removePlace(index) {
    selectedPlaces.splice(index, 1);
    markers[index].setMap(null);
    markers.splice(index, 1);
    
    markers.forEach((marker, i) => {
        marker.setLabel({
            text: String(i + 1),
            color: 'white',
            fontWeight: 'bold'
        });
    });
    
    updatePlacesList();
    updateGenerateButton();
}

function updateGenerateButton() {
    const btn = document.getElementById('generateBtn');
    btn.disabled = selectedPlaces.length === 0 || !openaiApiKey;
}

async function generateItinerary() {
    const resultsContainer = document.getElementById('results');
    
    resultsContainer.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <h3>AI가 최적의 여행 일정을 생성하고 있습니다...</h3>
            <p>잠시만 기다려주세요</p>
        </div>
    `;

    try {
        const placesInfo = selectedPlaces.map((place, index) => 
            `${index + 1}. ${place.name} (${place.address})`
        ).join('\n');

        const theme = themeInfo[selectedTheme];

        const prompt = `당신은 전문 여행 계획사입니다. 다음 조건으로 하루 여행 일정을 매우 상세하게 작성해주세요:

**여행 테마**: ${theme.name}
**테마 특징**: ${theme.description}

**필수 방문 장소 (${selectedPlaces.length}곳)**:
${placesInfo}

**중요 요구사항**:
1. 위에 나열된 ${selectedPlaces.length}개 장소는 반드시 모두 일정에 포함해야 합니다.
2. 필수 장소 외에도 ${theme.keywords} 특성에 맞는 추가 장소들(맛집, 카페, 포토존, 휴게 공간 등)을 2-3곳 추천하여 일정에 포함해주세요.
3. 추가 장소는 필수 장소들 사이의 동선을 고려하여 자연스럽게 배치해주세요.

다음 형식으로 작성해주세요:

**📍 추천 방문 순서 및 이동 경로**
- 필수 장소들과 추가 추천 장소들의 최적 방문 순서를 설명
- 각 장소 간 이동 방법과 예상 소요 시간
- ${theme.name} 테마에 맞는 동선 구성 이유

**⏰ 시간별 상세 일정**
각 장소(필수 + 추가)마다:
- 도착 시간과 예상 체류 시간
- 주요 볼거리와 ${theme.keywords} 특성에 맞는 활동
- 추천 활동 또는 사진 스팟
- 실용적인 팁 (입장료, 운영시간, 주의사항 등)
- [필수 코스] 또는 [추천 코스] 라벨 표시

**🍽️ 식사 및 휴식 추천**
- 점심과 저녁 식사 시간 및 ${theme.name} 테마에 어울리는 맛집
- 근처 ${theme.keywords} 특성의 카페나 휴식 장소
- 각 장소의 특징과 추천 메뉴

**💡 ${theme.name} 맞춤 여행 팁**
- 전체 일정의 소요 시간
- ${theme.name}에 적합한 준비물
- 날씨나 시즌별 추천사항
- 예산 관련 조언

친근하고 상세하게 작성해주세요!`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 전문적이고 친절한 여행 계획사입니다. 사용자가 선택한 필수 장소를 모두 포함하면서도, 테마에 맞는 추가 장소들을 자연스럽게 추천하여 완벽한 여행 일정을 만듭니다.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 3000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API 호출 실패');
        }

        const data = await response.json();
        const itinerary = data.choices[0].message.content;

        const formattedItinerary = formatItinerary(itinerary);

        resultsContainer.innerHTML = `
            <div class="itinerary-result">
                <h3>🎯 ${theme.name} 맞춤 여행 일정</h3>
                <div class="itinerary-content">${formattedItinerary}</div>
            </div>
        `;

    } catch (error) {
        console.error('일정 생성 오류:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3 style="color: #ff4757;">⚠️ 일정 생성 중 오류가 발생했습니다</h3>
                <p>${error.message}</p>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    API 키가 올바른지 확인하고, OpenAI 계정에 충분한 크레딧이 있는지 확인해주세요.
                </p>
            </div>
        `;
    }
}

function formatItinerary(text) {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

document.getElementById('generateBtn').addEventListener('click', generateItinerary);

window.initMap = initMap;