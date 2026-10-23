/* 攻撃 → ダメージ → HP更新 → Death。既存モデルのクリップを使う。 */
const preview = new URLSearchParams(location.search).get('preview') === '1';
const attackButton = document.getElementById('attack');
const resetButton = document.getElementById('reset');
const hpBar = document.getElementById('hpBar');
const hpText = document.getElementById('hpText');
const statusText = document.getElementById('status');
const flash = document.getElementById('flash');
const soundCheckbox = document.getElementById('sound');
const idleClip = 'RobotArmature|Robot_Idle';
const damageClip = 'RobotArmature|Robot_No';
const deathClip = 'RobotArmature|Robot_Death';
let hp = 100;
let state = 'loading';
let markerVisible = preview;
let damageTimer;
let audioContext;
let cameraFailed = false;

// Previewではカメラを起動しない。ARと同じ戦闘処理を使う。
const scene = document.createElement('a-scene');
scene.setAttribute('embedded', '');
scene.setAttribute('vr-mode-ui', 'enabled: false');
scene.setAttribute('renderer', 'antialias: true');
if (!preview) scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false');
const marker = document.createElement(preview ? 'a-entity' : 'a-marker');
marker.id = 'marker';
if (!preview) {
    marker.setAttribute('preset', 'hiro');
    marker.setAttribute('smooth', 'true');
}
const robot = document.createElement('a-gltf-model');
robot.id = 'robot';
robot.setAttribute('src', '../robot.glb');
robot.setAttribute('position', '0 0 0.5');
robot.setAttribute('scale', '0.3 0.3 0.3');
robot.setAttribute('rotation', '-90 0 0');
marker.appendChild(robot);
scene.appendChild(marker);
const camera = document.createElement('a-entity');
camera.setAttribute('camera', '');
if (preview) {
    // プレビューのみ、モデルとカメラを通常のY-up空間に置く。
    robot.setAttribute('rotation', '0 0 0');
    robot.setAttribute('position', '0 0 0');
    camera.setAttribute('position', '0 0.65 2.8');
    scene.setAttribute('background', 'color: #e7eef5');
    document.getElementById('guide').textContent = 'カメラなしプレビュー。4回の攻撃で倒れます。';
    document.getElementById('modeLink').href = './';
    document.getElementById('modeLink').textContent = 'Hiro マーカーの AR に切り替える';
}
scene.appendChild(camera);

function updateButtons() {
    attackButton.disabled = state !== 'ready' || !markerVisible || cameraFailed;
    resetButton.disabled = state === 'loading' || state === 'error';
}
function updateHP() {
    hpBar.value = hp;
    hpText.textContent = 'HP ' + hp + ' / 100';
}
function playClip(name, once) {
    // コンポーネントを作り直し、リセット時も同じクリップを先頭から再生する。
    robot.removeAttribute('animation-mixer');
    robot.setAttribute('animation-mixer', {
        clip: name, loop: once ? 'once' : 'repeat',
        clampWhenFinished: once, crossFadeDuration: 0, timeScale: 1
    });
}
function playSound(isDeath) {
    if (!soundCheckbox.checked) return;
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;
    try {
        if (!audioContext) audioContext = new AudioClass();
        audioContext.resume().catch(ignoreAudioError);
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(isDeath ? 180 : 340, now);
        oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.22);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.26);
    } catch (error) { /* 音が使えなくても戦闘は続ける。 */ }
}
function ignoreAudioError() {}
function clearDamage() {
    clearTimeout(damageTimer);
    flash.classList.remove('hit');
}
function readyMessage() {
    if (cameraFailed) { cameraError(); return; }
    statusText.textContent = markerVisible ? '攻撃ボタンでロボットにダメージ！' : 'Hiro マーカーを映してください。';
}
function attack() {
    if (state !== 'ready' || !markerVisible || cameraFailed) return;
    hp = Math.max(0, hp - 25);
    updateHP();
    flash.classList.add('hit');
    playSound(hp === 0);
    if (hp === 0) {
        state = 'dead';
        playClip(deathClip, true);
        statusText.textContent = 'HP 0！ Death で倒れます。リセットでもう一度。';
    } else {
        state = 'damage';
        playClip(damageClip, true);
        statusText.textContent = '25 ダメージ！ Robot_No で反応します。';
    }
    updateButtons();
    damageTimer = setTimeout(finishDamage, 650);
}
function finishDamage() {
    flash.classList.remove('hit');
    if (state !== 'damage') return;
    state = 'ready';
    playClip(idleClip, false);
    readyMessage();
    updateButtons();
}
function resetBattle() {
    if (state === 'loading' || state === 'error') return;
    clearDamage();
    hp = 100;
    state = 'ready';
    playClip(idleClip, false);
    updateHP();
    readyMessage();
    updateButtons();
}
function modelLoaded(event) {
    const clips = event.detail.model.animations;
    const names = clips.map(clipName);
    if (!names.includes(idleClip) || !names.includes(damageClip) || !names.includes(deathClip)) {
        modelError();
        return;
    }
    state = 'ready';
    resetBattle();
}
function clipName(clip) { return clip.name; }
function modelError() {
    state = 'error';
    clearDamage();
    statusText.textContent = 'モデルを読み込めません。通信を確認してページを再読み込みしてください。';
    updateButtons();
}
function markerFound() {
    markerVisible = true;
    if (state === 'ready') readyMessage();
    updateButtons();
}
function markerLost() {
    markerVisible = false;
    if (state === 'ready') readyMessage();
    updateButtons();
}
function cameraError() {
    cameraFailed = true;
    statusText.textContent = 'カメラを使えません。ブラウザの許可を確認するか「カメラなしで試す」を選んでください。';
    updateButtons();
}
robot.addEventListener('model-loaded', modelLoaded);
robot.addEventListener('model-error', modelError);
marker.addEventListener('markerFound', markerFound);
marker.addEventListener('markerLost', markerLost);
window.addEventListener('camera-error', cameraError);
attackButton.addEventListener('click', attack);
resetButton.addEventListener('click', resetBattle);
document.body.appendChild(scene);
