// --- 1. KONFIGURASI API & GLOBAL ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5TdGNPS58uNfg5vC4ysxN-4_t6ojjcnF80LZU28YEZ776LmevU5170bJ94qRO7Pf1/exec"; 

let dataGlobal = []; 
let statusGlobal = []; 
let grafikInstance = null;
let currentSlide = 'status';
let isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

// --- 2. FUNGSI UTAMA PENGAMBIL DATA ---
async function muatDataOtomatis() {
    const icon = document.getElementById("updateIcon");
    if (icon) icon.innerText = "⏳";

    try {
        const response = await fetch(`${SCRIPT_URL}?action=ambilData`);
        const data = await response.json();
        
        dataGlobal = data.logs || [];
        statusGlobal = data.statusTx || [];

        inisialisasiHalaman();

        const skrg = new Date();
        const lastUpdatedText = `Update: ${skrg.getHours().toString().padStart(2, '0')}:${skrg.getMinutes().toString().padStart(2, '0')} WIB`;
        if (document.getElementById("lastUpdated")) {
            document.getElementById("lastUpdated").innerText = lastUpdatedText;
        }
        if (icon) icon.innerText = "✅";
        setTimeout(() => { if (icon) icon.innerText = "🔄"; }, 3000);
    } catch (error) {
        console.error("Gagal Sinkron:", error);
        if (document.getElementById("lastUpdated")) {
            document.getElementById("lastUpdated").innerText = "Gagal Sinkron";
        }
    }
}

function inisialisasiHalaman() {
    if (document.getElementById("gridStatusTx")) updateBeranda();
    if (document.getElementById("tabelBody")) {
        prosesFilterDropdown();
        tampilkanLogTabel();
    }
    if (document.getElementById("grafikPegawai")) renderGrafik();
}

// --- 3. LOGIKA DASHBOARD (index.html) ---
function updateBeranda() {
    if (document.getElementById("statTotalLaporan")) document.getElementById("statTotalLaporan").innerText = dataGlobal.length;

    if (document.getElementById("statHariIni")) {
        const hariIni = new Date().toLocaleDateString('en-CA');
        const countHariIni = dataGlobal.filter(i => new Date(i.timestampTanggal).toLocaleDateString('en-CA') === hariIni).length;
        document.getElementById("statHariIni").innerText = countHariIni;
    }

    if (document.getElementById("statTotalPersonel")) {
        const listPetugas = [...new Set(dataGlobal.map(i => i.nama))].filter(n => n);
        document.getElementById("statTotalPersonel").innerText = listPetugas.length;
    }

    if (document.getElementById("statEviden")) {
        const txNormal = statusGlobal.filter(i => {
            const s = i.status ? i.status.toLowerCase().trim() : "";
            return s === "normal" || s === "on" || s === "online";
        }).length;
        document.getElementById("statEviden").innerText = txNormal;
    }

    let statusHtml = "";
    statusGlobal.forEach(item => {
        let cls = "status-badge-warn";
        let s = item.status ? item.status.toLowerCase().trim() : "";
        if (s === "normal" || s === "on" || s === "online") cls = "status-badge-on";
        if (s === "off" || s === "down" || s === "off-air") cls = "status-badge-off";
        
        statusHtml += `
            <div class="col-6 col-md-3">
                <div class="site-card p-2 text-center shadow-sm border">
                    <div class="small fw-bold text-dark">${item.site}</div>
                    <span class="badge ${cls} w-100 mt-1" style="font-size:10px">${item.status}</span>
                </div>
            </div>`;
    });
    if (document.getElementById("gridStatusTx")) document.getElementById("gridStatusTx").innerHTML = statusHtml;

    const recent = [...dataGlobal].sort((a, b) => {
    return new Date(b.timestampTanggal) - new Date(a.timestampTanggal);
    }).slice(0, 5);

    const listRecent = document.getElementById("listRecentActivity");
    if (listRecent) {
        listRecent.innerHTML = recent.map(i => {
            // Ambil jam dan menit dari timestamp
            const d = new Date(i.timestampTanggal);
            const jam = d.getHours().toString().padStart(2, '0');
            const menit = d.getMinutes().toString().padStart(2, '0');

            return `
                <li class="list-group-item d-flex justify-content-between align-items-center py-3">
                    <div style="max-width: 85%;">
                        <div class="fw-bold" style="font-size:14px; color:#003366">${i.nama}</div>
                        <small class="text-muted">
                            📅 ${formatTanggalIndo(i.timestampTanggal)} • 🕒 ${jam}:${menit}
                        </small>
                        <div class="mt-1 text-dark" style="font-size:13px; line-height:1.4;">
                            ${i.uraian ? i.uraian.substring(0, 60) : '-'}...
                        </div>
                    </div>
                    <span class="badge bg-primary rounded-pill" style="font-size:10px">${i.shift || '-'}</span>
                </li>`;
        }).join('') || '<li class="list-group-item text-center">Belum ada aktivitas</li>';
    }
}

// --- 4. LOGIKA TABEL (log-petugas.html) ---
function prosesFilterDropdown() {
    const filterNama = document.getElementById("filterNama");
    if (filterNama && filterNama.innerHTML === "") {
        const names = [...new Set(dataGlobal.map(i => i.nama))].filter(n => n).sort();
        let html = '<option value="Semua">Tampilkan Semua</option>';
        names.forEach(n => html += `<option value="${n}">${n}</option>`);
        filterNama.innerHTML = html;
        
        const years = [...new Set(dataGlobal.map(i => new Date(i.timestampTanggal).getFullYear()))].sort((a,b) => b-a);
        let htmlTahun = '<option value="Semua">Semua Tahun</option>';
        years.forEach(y => htmlTahun += `<option value="${y}">${y}</option>`);
        document.getElementById("filterTahun").innerHTML = htmlTahun;
    }
}

function tampilkanLogTabel() {
    const n = document.getElementById("filterNama").value;
    const b = document.getElementById("filterBulan").value;
    const t = document.getElementById("filterTahun").value;
    const tBody = document.getElementById("tabelBody");
    if (!tBody) return;

    // Filter data terlebih dahulu
    const filtered = dataGlobal.filter(i => {
        const d = new Date(i.timestampTanggal);
        return (n === "Semua" || i.nama === n) && 
               (b === "Semua" || d.getMonth().toString() === b) && 
               (t === "Semua" || d.getFullYear().toString() === t);
    });

    // PROSES SORTING: Membandingkan waktu secara milidetik (Latest First)
    filtered.sort((a, b) => {
        return new Date(b.timestampTanggal) - new Date(a.timestampTanggal);
    });

    tBody.innerHTML = filtered.map(i => {
        let docs = "";
        if (i.link1?.includes("http")) docs += `<a href="${i.link1}" target="_blank" class="btn btn-primary btn-eviden">E1</a>`;
        if (i.link2?.includes("http")) docs += `<a href="${i.link2}" target="_blank" class="btn btn-info btn-eviden text-white">E2</a>`;
        if (i.link3?.includes("http")) docs += `<a href="${i.link3}" target="_blank" class="btn btn-secondary btn-eviden">E3</a>`;
        
        return `
            <tr>
                <td class="text-center">${formatTanggalIndo(i.timestampTanggal)}</td>
                <td class="text-center">${i.nama}</td>
                <td class="text-center">${i.shift || '-'}</td>
                <td class="text-center small">${i.mulai} - ${i.selesai}</td> 
                <td>${i.sasaran || ''}</td>
                <td>${i.uraian || ''}</td>
                <td class="text-center">${docs || '-'}</td>
                <td>${i.keterangan || '-'}</td>
            </tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center py-4">Data tidak ditemukan</td></tr>';
}

// --- 5. LOGIKA SIDEBAR & MODAL (Auto-Inject) ---
function renderSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";

    let sidebarHTML = `
    <div class="offcanvas offcanvas-start text-white" tabindex="-1" id="menuSidebar">
      <div class="offcanvas-header">
        <h5 class="offcanvas-title">Menu E-Kinerja</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
      </div>
      <div class="offcanvas-body p-0 mt-3">
        <div class="list-group list-group-flush">
          <a href="index.html" class="menu-modern ${page === 'index.html' ? 'active' : ''}"><span class="menu-icon">🏠</span> Dashboard</a>
          <a href="log-petugas.html" class="menu-modern ${page === 'log-petugas.html' ? 'active' : ''}"><span class="menu-icon">📋</span> Log Kinerja</a>
          <a href="statistik.html" class="menu-modern ${page === 'statistik.html' ? 'active' : ''}"><span class="menu-icon">📈</span> Statistik</a>
          <hr class="mx-3 my-2 opacity-10">
          
          <a href="#" data-bs-toggle="modal" data-bs-target="#profilModal" onclick="isiDataProfil()" class="menu-modern">
            <span class="menu-icon">👤</span> Profil User
          </a>`;

    if (isLoggedIn) {
        sidebarHTML += `
          <a href="#" onclick="tambahUserBaru()" class="menu-modern" style="background: rgba(40, 167, 69, 0.1);">
            <span class="menu-icon">➕</span> Tambah User (Admin)
          </a>`;
    }

    sidebarHTML += `
          <hr class="mx-3 my-2 opacity-10">
          <a href="https://s.id/formindividu" target="_blank" class="menu-modern"><span class="menu-icon">📝</span> Input Form</a>
          <a href="#" ${isLoggedIn ? 'onclick="logoutAdmin()"' : 'data-bs-toggle="modal" data-bs-target="#loginModal"'} class="menu-modern">
            <span class="menu-icon">${isLoggedIn ? '🔓' : '🔐'}</span> <span>${isLoggedIn ? 'Logout Admin' : 'Login Admin'}</span>
          </a>
        </div>
      </div>
    </div>

    <div class="modal fade" id="profilModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow text-dark">
          <div class="modal-header text-white" style="background-color: #003366;">
            <h5 class="modal-title">👤 Profil Petugas</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center p-4">
            <img src="" class="rounded-circle mb-3 shadow-sm" id="profPic" style="width:100px; height:100px;">
            <h4 class="fw-bold mb-0" id="profNama">Nama Petugas</h4>
            <p class="text-muted small mb-3">Asisten Teknisi Siaran - TVRI Riau</p>
            <div class="text-start border-top pt-3">
              <div class="mb-2"><small class="fw-bold text-muted">STATUS LOGIN:</small><br><span class="badge bg-success">${isLoggedIn ? 'Administrator' : 'Petugas Umum'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    container.innerHTML = sidebarHTML;
}

// --- 6. LOGIKA LOGIN & UTILITY ---
function prosesLogin() {
    const user = document.getElementById('inputUser').value;
    const pass = document.getElementById('inputPass').value;
    if (user === "Admin" && pass === "txpku1") {
        isLoggedIn = true;
        localStorage.setItem("isLoggedIn", "true");
        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if(modal) modal.hide();
        renderSidebar();
        alert("Otorisasi Berhasil!");
    } else {
        alert("Username/Password Salah!");
    }
}

function logoutAdmin() {
    isLoggedIn = false;
    localStorage.setItem("isLoggedIn", "false");
    renderSidebar();
    alert("Berhasil Logout.");
}

function isiDataProfil() {
    // 1. Tentukan nama berdasarkan status login
    let namaTampilan = isLoggedIn ? "Admin" : "Anonymous";

    // 2. Ambil elemen HTML
    const elNama = document.getElementById('profNama');
    const elPic = document.getElementById('profPic');

    // 3. Masukkan data ke tampilan
    if (elNama) {
        elNama.innerText = namaTampilan;
    }
    
    if (elPic) {
        // Menggunakan UI Avatars agar foto profil berubah sesuai nama
        elPic.src = `https://ui-avatars.com/api/?name=${namaTampilan}&background=003366&color=fff&size=128`;
    }
    
    // Opsional: Update status label di bawah nama
    const elStatus = document.querySelector('#profilModal .badge');
    if (elStatus) {
        elStatus.innerText = isLoggedIn ? "Administrator" : "-";
        elStatus.className = isLoggedIn ? "badge bg-success" : "badge bg-secondary";
    }
}

function tambahUserBaru() {
    alert("Fitur Tambah User Admin sedang disiapkan di Google Sheets TVRI.");
}

function formatTanggalIndo(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    
    // Mengambil tanggal (tanpa angka 0 di depan untuk tanggal 1-9)
    const tanggal = d.getDate(); 
    
    // Daftar bulan dalam Bahasa Indonesia
    const daftarBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const bulan = daftarBulan[d.getMonth()];
    const tahun = d.getFullYear();

    return `${tanggal} ${bulan} ${tahun}`;
}

// --- 7. ANIMASI FADE & RUN ---
function startAutoToggle() {
    const sEl = document.getElementById('itemStatus');
    const rEl = document.getElementById('itemRecent');
    if (!sEl || !rEl) return;

    setInterval(() => {
        const slideStatus = document.getElementById('itemStatus');
        const slideRecent = document.getElementById('itemRecent');
        if (currentSlide === 'status') {
            slideStatus.classList.remove('active');
            slideRecent.classList.add('active');
            currentSlide = 'recent';
        } else {
            slideRecent.classList.remove('active');
            slideStatus.classList.add('active');
            currentSlide = 'status';
        }
    }, 8000);
}

// --- 8. LOGIKA GRAFIK (statistik.html) ---
function renderGrafik() {
    const canvas = document.getElementById('grafikPegawai');
    // Jika elemen canvas tidak ada (berarti bukan di halaman statistik), batalkan proses
    if (!canvas) return; 

    const ctx = canvas.getContext('2d');
    
    // Hitung data berdasarkan nama petugas
    const counts = {};
    dataGlobal.forEach(i => { 
        if(i.nama && i.nama.trim() !== "") {
            counts[i.nama] = (counts[i.nama] || 0) + 1; 
        }
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    // Jika dataGlobal masih kosong, tampilkan pesan di Console agar kita tahu
    if (labels.length === 0) {
        console.warn("Data untuk grafik belum siap.");
        return;
    }

    // Hapus grafik lama sebelum menggambar yang baru (agar tidak tumpang tindih)
    if (grafikInstance) {
        grafikInstance.destroy();
    }
    
    // Pastikan library Chart.js sudah ter-load di statistik.html
    if (typeof Chart === 'undefined') {
        console.error("Library Chart.js tidak ditemukan! Pastikan CDN Chart.js sudah dipasang di statistik.html");
        return;
    }

    grafikInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Kegiatan Petugas',
                data: values,
                backgroundColor: '#003366',
                borderColor: '#002244',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

async function buatPreview() {
    // 1. Cek Login
    if (!isLoggedIn) { 
        alert("Akses Ditolak! Silakan Login Admin terlebih dahulu melalui menu sidebar."); 
        return; 
    }
    
    const btn = document.getElementById("btnPreview");
    const n = document.getElementById("filterNama").value;
    const b = document.getElementById("filterBulan").value;
    const t = document.getElementById("filterTahun").value;
    const linkContainer = document.getElementById("tempatLink");

    // 2. Cek apakah Nama sudah dipilih
    if (n === "Semua") {
        alert("Silakan pilih satu Nama Petugas untuk mencetak PDF.");
        return;
    }

    btn.innerHTML = "⏳ Sedang Memproses...";
    btn.disabled = true;

    try {
        const urlRequest = `${SCRIPT_URL}?action=previewPDF&nama=${encodeURIComponent(n)}&bulan=${b}&tahun=${t}`;
        const response = await fetch(urlRequest);
        const hasil = await response.json();
        
        btn.innerHTML = "📄 PDF PREVIEW";
        btn.disabled = false;

        if (hasil.success) {
            // Munculkan tombol biru untuk buka PDF
            linkContainer.innerHTML = `
                <a href="${hasil.url}" target="_blank" class="btn btn-primary w-100 fw-bold animate__animated animate__bounceIn">
                     BUKA PDF
                </a>`;
        } else {
            alert("Gagal: " + hasil.message);
        }
    } catch (err) {
        console.error(err);
        alert("Gagal menghubungi server Google. Pastikan URL Web App sudah benar.");
        btn.innerHTML = "📄 PDF PREVIEW";
        btn.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderSidebar(); 
    muatDataOtomatis();
    startAutoToggle(); 
});
setInterval(muatDataOtomatis, 600000);