/**
 * 초등학교 5학년 사회 - 조선 시대 문화 퀴즈 웹앱
 * 주요 기능:
 * 1. 10문제 4지선다 순차 풀이 및 즉각적인 정오답 피드백
 * 2. 한두 문장 쉬운 해설 제공
 * 3. 최종 점수 집계, 조선 시대 칭호, 오답/전체 복습 기능
 * 4. Web Audio API 기반 오프라인 효과음 (정답/오답/팬파레)
 * 5. 축하 캔버스 폭죽(Confetti) 효과
 * 6. 교실 TV & 스마트폰 맞춤 글자 크기 조절 기능
 */

(() => {
  'use strict';

  // -------------------------------------------------------------
  // 1. 상태 관리
  // -------------------------------------------------------------
  const state = {
    currentIndex: 0,
    score: 0,
    answered: false,
    soundEnabled: true,
    fontSizeMode: 'normal', // 'small' | 'normal' | 'large' | 'xlarge'
    records: [] // 각 문제별 사용자 선택, 정답 여부 기록
  };

  // -------------------------------------------------------------
  // 2. DOM 요소 참조
  // -------------------------------------------------------------
  const elements = {
    body: document.body,
    // 화면 섹션
    startScreen: document.getElementById('start-screen'),
    quizScreen: document.getElementById('quiz-screen'),
    resultScreen: document.getElementById('result-screen'),
    // 시작 버튼
    startBtn: document.getElementById('start-btn'),
    // 퀴즈 헤더/메타
    categoryBadge: document.getElementById('category-badge'),
    questionCounter: document.getElementById('question-counter'),
    liveScore: document.getElementById('live-score'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    // 문제 & 보기
    qNumberIndicator: document.getElementById('q-number-indicator'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    // 피드백 영역
    feedbackPanel: document.getElementById('feedback-panel'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackExplanation: document.getElementById('feedback-explanation'),
    nextBtn: document.getElementById('next-btn'),
    // 결과 화면 요소
    resultEmblem: document.getElementById('result-emblem'),
    resultTitle: document.getElementById('result-title'),
    finalScore: document.getElementById('final-score'),
    correctCount: document.getElementById('correct-count'),
    wrongCount: document.getElementById('wrong-count'),
    resultMessage: document.getElementById('result-message'),
    restartBtn: document.getElementById('restart-btn'),
    toggleReviewBtn: document.getElementById('toggle-review-btn'),
    reviewContainer: document.getElementById('review-container'),
    reviewList: document.getElementById('review-list'),
    // 글자 크기 & 사운드 컨트롤
    fontDecreaseBtn: document.getElementById('font-decrease-btn'),
    fontResetBtn: document.getElementById('font-reset-btn'),
    fontIncreaseBtn: document.getElementById('font-increase-btn'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundIcon: document.getElementById('sound-icon'),
    soundText: document.getElementById('sound-text'),
    confettiCanvas: document.getElementById('confetti-canvas')
  };

  // -------------------------------------------------------------
  // 3. Web Audio API 사운드 시스템 (외부 파일 없이 작동)
  // -------------------------------------------------------------
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = 'sine', startTime = 0, gainLevel = 0.15) {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);

      gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime + startTime);
      osc.stop(audioCtx.currentTime + startTime + duration);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  // 효과음 모음
  const soundEffects = {
    // 딩동댕 (정답)
    correct() {
      playTone(523.25, 0.12, 'triangle', 0, 0.2);     // C5
      playTone(659.25, 0.14, 'triangle', 0.10, 0.22); // E5
      playTone(783.99, 0.16, 'triangle', 0.22, 0.24); // G5
      playTone(1046.50, 0.35, 'triangle', 0.34, 0.26); // C6
    },
    // 띠로리 (오답)
    wrong() {
      playTone(392.00, 0.18, 'sawtooth', 0, 0.12);    // G4
      playTone(349.23, 0.25, 'sawtooth', 0.16, 0.12); // F4
    },
    // 버튼 클릭음
    click() {
      playTone(800, 0.05, 'sine', 0, 0.08);
    },
    // 최종 결과 팡파레
    fanfare() {
      const notes = [
        { f: 523.25, t: 0, d: 0.15 },
        { f: 659.25, t: 0.12, d: 0.15 },
        { f: 783.99, t: 0.24, d: 0.18 },
        { f: 1046.50, t: 0.40, d: 0.5 }
      ];
      notes.forEach(n => playTone(n.f, n.d, 'triangle', n.t, 0.2));
    }
  };

  // -------------------------------------------------------------
  // 4. 가벼운 캔버스 폭죽(Confetti) 효과
  // -------------------------------------------------------------
  const confetti = {
    ctx: null,
    particles: [],
    animationId: null,
    width: 0,
    height: 0,

    init() {
      const canvas = elements.confettiCanvas;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      elements.confettiCanvas.width = this.width;
      elements.confettiCanvas.height = this.height;
    },

    fire(count = 70) {
      this.particles = [];
      const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#ec4899', '#8b5cf6'];
      
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: this.width * (0.3 + Math.random() * 0.4),
          y: this.height * 0.5,
          vx: (Math.random() - 0.5) * 16,
          vy: -Math.random() * 14 - 6,
          size: Math.random() * 8 + 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          gravity: 0.38,
          opacity: 1
        });
      }

      if (!this.animationId) {
        this.loop();
      }
    },

    loop() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      let alive = false;
      for (let p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.008;

        if (p.opacity > 0 && p.y < this.height + 50) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
        }
      }

      if (alive) {
        this.animationId = requestAnimationFrame(() => this.loop());
      } else {
        ctx.clearRect(0, 0, this.width, this.height);
        this.animationId = null;
      }
    }
  };

  // -------------------------------------------------------------
  // 5. 화면 전환 제어
  // -------------------------------------------------------------
  function showScreen(screenKey) {
    elements.startScreen.classList.remove('active');
    elements.quizScreen.classList.remove('active');
    elements.resultScreen.classList.remove('active');

    if (screenKey === 'start') {
      elements.startScreen.classList.add('active');
    } else if (screenKey === 'quiz') {
      elements.quizScreen.classList.add('active');
    } else if (screenKey === 'result') {
      elements.resultScreen.classList.add('active');
    }
  }

  // -------------------------------------------------------------
  // 6. 퀴즈 진행 로직
  // -------------------------------------------------------------
  function startQuiz() {
    initAudio();
    soundEffects.click();

    state.currentIndex = 0;
    state.score = 0;
    state.answered = false;
    state.records = [];

    renderQuestion();
    showScreen('quiz');
  }

  function renderQuestion() {
    const qData = QUIZ_DATA[state.currentIndex];
    const totalQ = QUIZ_DATA.length;
    const qNum = state.currentIndex + 1;

    state.answered = false;

    // 헤더 및 메타 업데이트
    elements.categoryBadge.textContent = qData.category;
    elements.questionCounter.innerHTML = `문제 <strong>${qNum}</strong> / ${totalQ}`;
    elements.liveScore.textContent = state.score;
    elements.qNumberIndicator.textContent = qNum;

    // 진행 바 게이지
    const progressPercent = Math.round((qNum / totalQ) * 100);
    elements.progressBarFill.style.width = `${progressPercent}%`;

    // 문제 텍스트
    elements.questionText.textContent = qData.question;

    // 보기(4지선다) 생성
    elements.optionsContainer.innerHTML = '';
    const numberSymbols = ['①', '②', '③', '④'];

    qData.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.dataset.index = idx;

      btn.innerHTML = `
        <span class="option-num">${numberSymbols[idx]}</span>
        <span class="option-text">${optText}</span>
        <span class="option-status-icon"></span>
      `;

      btn.addEventListener('click', () => handleOptionClick(idx, btn));
      elements.optionsContainer.appendChild(btn);
    });

    // 피드백 패널 숨기기
    elements.feedbackPanel.className = 'feedback-panel hidden';

    // 마지막 문제일 경우 버튼 텍스트 변경
    if (state.currentIndex === totalQ - 1) {
      elements.nextBtn.innerHTML = `<span>최종 결과 확인하기</span> <span class="arrow-icon">🏆</span>`;
    } else {
      elements.nextBtn.innerHTML = `<span>다음 문제로 가기</span> <span class="arrow-icon">➔</span>`;
    }

    // 모바일/화면 상단으로 부드러운 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOptionClick(selectedIndex, chosenBtn) {
    if (state.answered) return;
    state.answered = true;
    initAudio();

    const qData = QUIZ_DATA[state.currentIndex];
    const isCorrect = (selectedIndex === qData.answer);

    // 기록 저장
    state.records.push({
      question: qData.question,
      category: qData.category,
      options: qData.options,
      selectedIndex,
      correctIndex: qData.answer,
      isCorrect,
      explanation: qData.explanation
    });

    // 모든 보기 버튼 비활성화 및 스타일 적용
    const allButtons = elements.optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach((btn, idx) => {
      btn.disabled = true;

      const iconSpan = btn.querySelector('.option-status-icon');

      if (idx === qData.answer) {
        // 정답 버튼
        if (isCorrect) {
          btn.classList.add('selected-correct');
          iconSpan.textContent = '✔';
        } else {
          btn.classList.add('reveal-correct');
          iconSpan.textContent = '✔ 정답';
        }
      } else if (idx === selectedIndex && !isCorrect) {
        // 오답으로 선택한 버튼
        btn.classList.add('selected-wrong');
        iconSpan.textContent = '✖';
      } else {
        btn.classList.add('dimmed');
      }
    });

    // 점수 및 효과음
    if (isCorrect) {
      state.score += 1;
      elements.liveScore.textContent = state.score;
      soundEffects.correct();
      confetti.fire(35);
      showFeedback(true, qData.explanation);
    } else {
      soundEffects.wrong();
      showFeedback(false, qData.explanation);
    }
  }

  function showFeedback(isCorrect, explanationText) {
    elements.feedbackPanel.classList.remove('hidden');

    if (isCorrect) {
      elements.feedbackPanel.className = 'feedback-panel correct';
      elements.feedbackIcon.textContent = '🎉';
      elements.feedbackTitle.textContent = '정답입니다! 참 잘했어요!';
    } else {
      elements.feedbackPanel.className = 'feedback-panel wrong';
      elements.feedbackIcon.textContent = '💡';
      elements.feedbackTitle.textContent = '아쉽네요! 정답을 확인해 보세요.';
    }

    elements.feedbackExplanation.textContent = explanationText;

    // 포커스를 다음 버튼으로 이동 (접근성 및 수업 편의)
    elements.nextBtn.focus();
  }

  function handleNextStep() {
    soundEffects.click();

    if (state.currentIndex < QUIZ_DATA.length - 1) {
      state.currentIndex += 1;
      renderQuestion();
    } else {
      showResults();
    }
  }

  // -------------------------------------------------------------
  // 7. 결과 화면 표시
  // -------------------------------------------------------------
  function showResults() {
    const totalQ = QUIZ_DATA.length;
    const finalScore = state.score * 10; // 100점 만점
    const wrongCount = totalQ - state.score;

    elements.finalScore.textContent = finalScore;
    elements.correctCount.textContent = `${state.score}개`;
    elements.wrongCount.textContent = `${wrongCount}개`;

    // 칭호 및 메시지 분기 (조선 시대 테마)
    let emblem = '👑';
    let title = '장원급제 대제학!';
    let message = '대단해요! 임금님도 깜짝 놀랄 만큼 조선 시대 문화를 완벽하게 이해하고 있군요!';

    if (finalScore === 100) {
      emblem = '👑';
      title = '장원급제 대제학!';
      message = '만점입니다! 세종대왕님과 장영실도 칭찬할 조선 최고의 역사 박사예요!';
    } else if (finalScore >= 80) {
      emblem = '📜';
      title = '암행어사 출두요!';
      message = '훌륭해요! 조선의 문화를 훤히 꿰뚫고 있는 지혜로운 암행어사의 실력입니다!';
    } else if (finalScore >= 60) {
      emblem = '📖';
      title = '성균관의 열정 유생!';
      message = '잘 풀었어요! 조금만 더 복습하면 다음엔 만점 장원급제에 도전할 수 있어요!';
    } else {
      emblem = '🌱';
      title = '조선 문화 탐험 꿈나무!';
      message = '수고했어요! 아래 해설을 읽어보고 한 번 더 도전하면 실력이 쑥쑥 늘 거예요!';
    }

    elements.resultEmblem.textContent = emblem;
    elements.resultTitle.textContent = title;
    elements.resultMessage.textContent = message;

    // 복습 컨테이너 닫아두기
    elements.reviewContainer.classList.add('hidden');
    elements.toggleReviewBtn.textContent = '📝 전체 해설 및 오답 복습하기';

    // 결과 화면 띄우기 및 팡파레/폭죽
    showScreen('result');
    soundEffects.fanfare();
    confetti.fire(90);
    setTimeout(() => confetti.fire(60), 600);
  }

  // -------------------------------------------------------------
  // 8. 오답 및 전체 해설 복습 기능
  // -------------------------------------------------------------
  function toggleReview() {
    soundEffects.click();
    const isHidden = elements.reviewContainer.classList.contains('hidden');

    if (isHidden) {
      renderReviewList();
      elements.reviewContainer.classList.remove('hidden');
      elements.toggleReviewBtn.textContent = '▲ 해설 접기';
      elements.reviewContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
      elements.reviewContainer.classList.add('hidden');
      elements.toggleReviewBtn.textContent = '📝 전체 해설 및 오답 복습하기';
    }
  }

  function renderReviewList() {
    const numberSymbols = ['①', '②', '③', '④'];
    elements.reviewList.innerHTML = '';

    state.records.forEach((rec, idx) => {
      const item = document.createElement('div');
      item.className = `review-item ${rec.isCorrect ? 'is-correct' : 'is-wrong'}`;

      const statusBadge = rec.isCorrect 
        ? `<span class="review-badge correct">정답 ⭕</span>`
        : `<span class="review-badge wrong">오답 ❌</span>`;

      const chosenOptionText = `${numberSymbols[rec.selectedIndex]} ${rec.options[rec.selectedIndex]}`;
      const correctOptionText = `${numberSymbols[rec.correctIndex]} ${rec.options[rec.correctIndex]}`;

      item.innerHTML = `
        <div class="review-item-header">
          <span class="review-q-title">Q${idx + 1}. [${rec.category}] ${rec.question}</span>
          ${statusBadge}
        </div>
        <div class="review-answers">
          ${!rec.isCorrect ? `<div class="review-ans-chosen">👉 내가 고른 답: ${chosenOptionText}</div>` : ''}
          <div class="review-ans-correct">✅ 정답: ${correctOptionText}</div>
        </div>
        <div class="review-explanation">
          💡 <strong>해설:</strong> ${rec.explanation}
        </div>
      `;

      elements.reviewList.appendChild(item);
    });
  }

  // -------------------------------------------------------------
  // 9. 교실 TV & 스마트폰 글자 크기 조절
  // -------------------------------------------------------------
  function setFontSizeMode(mode) {
    state.fontSizeMode = mode;
    elements.body.setAttribute('data-font-size', mode);

    elements.fontDecreaseBtn.classList.toggle('active', mode === 'small');
    elements.fontResetBtn.classList.toggle('active', mode === 'normal');
    elements.fontIncreaseBtn.classList.toggle('active', mode === 'large' || mode === 'xlarge');

    try {
      localStorage.setItem('history_quiz_font_size', mode);
    } catch (e) {}
  }

  function handleFontIncrease() {
    soundEffects.click();
    if (state.fontSizeMode === 'small') setFontSizeMode('normal');
    else if (state.fontSizeMode === 'normal') setFontSizeMode('large');
    else if (state.fontSizeMode === 'large') setFontSizeMode('xlarge');
  }

  function handleFontDecrease() {
    soundEffects.click();
    if (state.fontSizeMode === 'xlarge') setFontSizeMode('large');
    else if (state.fontSizeMode === 'large') setFontSizeMode('normal');
    else if (state.fontSizeMode === 'normal') setFontSizeMode('small');
  }

  // -------------------------------------------------------------
  // 10. 사운드 토글
  // -------------------------------------------------------------
  function toggleSound() {
    initAudio();
    state.soundEnabled = !state.soundEnabled;

    if (state.soundEnabled) {
      elements.soundIcon.textContent = '🔊';
      elements.soundText.textContent = '소리 켬';
      elements.soundToggleBtn.classList.remove('muted');
      soundEffects.click();
    } else {
      elements.soundIcon.textContent = '🔇';
      elements.soundText.textContent = '소리 끔';
      elements.soundToggleBtn.classList.add('muted');
    }

    try {
      localStorage.setItem('history_quiz_sound', state.soundEnabled ? 'true' : 'false');
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // 11. 초기화 & 이벤트 리스너 등록
  // -------------------------------------------------------------
  function init() {
    confetti.init();

    // 로컬 스토리지 복원
    try {
      const savedFont = localStorage.getItem('history_quiz_font_size');
      if (savedFont && ['small', 'normal', 'large', 'xlarge'].includes(savedFont)) {
        setFontSizeMode(savedFont);
      }
      const savedSound = localStorage.getItem('history_quiz_sound');
      if (savedSound !== null) {
        state.soundEnabled = (savedSound === 'true');
        if (!state.soundEnabled) {
          elements.soundIcon.textContent = '🔇';
          elements.soundText.textContent = '소리 끔';
          elements.soundToggleBtn.classList.add('muted');
        }
      }
    } catch (e) {}

    // 이벤트 리스너
    elements.startBtn.addEventListener('click', startQuiz);
    elements.nextBtn.addEventListener('click', handleNextStep);
    elements.restartBtn.addEventListener('click', () => {
      soundEffects.click();
      startQuiz();
    });
    elements.toggleReviewBtn.addEventListener('click', toggleReview);

    // 툴바 컨트롤
    elements.fontDecreaseBtn.addEventListener('click', handleFontDecrease);
    elements.fontResetBtn.addEventListener('click', () => {
      soundEffects.click();
      setFontSizeMode('normal');
    });
    elements.fontIncreaseBtn.addEventListener('click', handleFontIncrease);
    elements.soundToggleBtn.addEventListener('click', toggleSound);

    // 첫 인터랙션 시 오디오 컨텍스트 언락
    document.addEventListener('pointerdown', () => initAudio(), { once: true });
    document.addEventListener('keydown', () => initAudio(), { once: true });
  }

  // DOM 로드 완료 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
