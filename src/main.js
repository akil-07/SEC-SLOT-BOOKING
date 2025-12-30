import './style.css'
import staticData from './data.json';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Configuration
const TIME_SLOTS = ["8-10", "10-12", "1-3", "3-5"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// State
const state = {
  teacherMap: staticData.teacherMap, // TeacherName -> { subject, code, ... }
  slots: staticData.slots, // All slots from JSON
  bookedSlots: new Set(),  // Global booked slots (Teacher-Day-Time)
  myBookings: [],          // Local user bookings [{subject, teacher, day, time}]
  searchTerm: '',
  selectedSubject: null,   // New: Currently selected subject for timetable view
  modalTarget: null        // Slot currently being booked
};

// DOM Elements
const searchInput = document.getElementById('search-input');
const subjectListContainer = document.getElementById('subject-list');
const timetableGrid = document.querySelector('.timetable-grid');
const myBookingsList = document.getElementById('my-bookings-list');
const modal = document.getElementById('booking-modal');
const modalSubject = document.getElementById('modal-subject');
const modalTeacher = document.getElementById('modal-teacher');
const modalTime = document.getElementById('modal-time');
const confirmBookBtn = document.getElementById('confirm-book-btn');
const cancelBtn = document.getElementById('cancel-btn');
const toast = document.getElementById('toast');
const selectedContextDisplay = document.getElementById('selected-context');
const filesTitle = document.getElementById('files-title');
const downloadBtn = document.getElementById('download-btn');

// Initialization
function init() {
  loadLocalBookings();
  renderSubjectList();
  renderTimetable(); // Initial render (empty or filtered)
  setupEventListeners();
  updateMyBookingsUI();
}

function setupEventListeners() {
  searchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value.toLowerCase().trim();
    renderSubjectList(); // Filter the list
  });

  cancelBtn.addEventListener('click', closeModal);
  confirmBookBtn.addEventListener('click', handleBookingConfirm);
  downloadBtn.addEventListener('click', handleDownloadPDF);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function loadLocalBookings() {
  const saved = localStorage.getItem('myBookings');
  if (saved) {
    state.myBookings = JSON.parse(saved);
  }
}

function saveLocalBookings() {
  localStorage.setItem('myBookings', JSON.stringify(state.myBookings));
  updateMyBookingsUI();
}

function updateMyBookingsUI() {
  myBookingsList.innerHTML = '';
  if (state.myBookings.length === 0) {
    myBookingsList.innerHTML = '<li class="empty-msg">No slots booked yet.</li>';
    return;
  }

  state.myBookings.forEach((booking, index) => {
    const li = document.createElement('li');
    li.className = 'booking-item';
    li.innerHTML = `
      <div class="booking-info">
        <div class="booking-item-title">${booking.subject}</div>
        <div class="booking-item-time">${booking.day} | ${booking.time}</div>
        <div class="booking-item-teacher">${booking.teacher}</div>
      </div>
      <button class="delete-btn" title="Cancel Booking">×</button>
    `;

    // Attach delete handler
    li.querySelector('.delete-btn').addEventListener('click', () => deleteBooking(index));

    myBookingsList.appendChild(li);
  });
}

function deleteBooking(index) {
  const booking = state.myBookings[index];
  if (!booking) return;

  if (confirm(`Cancel ALL bookings for ${booking.subject}?`)) {
    // 1. Identify slots to remove (ALL slots for this subject)
    const subjectToRemove = booking.subject;
    const slotsToRemove = state.myBookings.filter(b => b.subject === subjectToRemove);

    // 2. Remove from Local State
    state.myBookings = state.myBookings.filter(b => b.subject !== subjectToRemove);
    saveLocalBookings();

    // 3. Remove from Global Mock State
    slotsToRemove.forEach(rem => {
      const globalKey = `${rem.teacher}-${rem.day}-${rem.time}`;
      state.bookedSlots.delete(globalKey);
    });

    // 4. Update UI
    updateMyBookingsUI();
    renderSubjectList(); // Updates the checkmark
    renderTimetable();
    showToast(`Cancelled all classes for ${subjectToRemove}`, true);
  }
}

function renderSubjectList() {
  subjectListContainer.innerHTML = '';

  // Convert map to array for sorting/filtering
  // Map: TeacherName -> { subject, code }
  const items = Object.entries(state.teacherMap).map(([teacher, data]) => ({
    teacher,
    subject: data.subject
  }));

  // Filter
  const filtered = items.filter(item => {
    if (!state.searchTerm) return true;
    return item.subject.toLowerCase().includes(state.searchTerm) ||
      item.teacher.toLowerCase().includes(state.searchTerm);
  });

  // Sort by Subject Name
  filtered.sort((a, b) => a.subject.localeCompare(b.subject));

  if (filtered.length === 0) {
    subjectListContainer.innerHTML = '<div style="padding:1rem; color:var(--text-muted)">No matches found</div>';
    return;
  }

  filtered.forEach(item => {
    const el = document.createElement('div');
    el.className = 'subject-item';
    if (state.selectedSubject === item.subject) {
      el.classList.add('active');
    }

    const isBooked = state.myBookings.some(b => b.subject === item.subject);
    if (isBooked) {
      el.classList.add('booked-subject');
    }

    el.innerHTML = `
      <span>
        ${item.subject}
        ${isBooked ? '<span style="color:var(--success); margin-left:0.5rem">✓</span>' : ''}
      </span>
      <span>${item.teacher}</span>
    `;

    el.onclick = () => selectSubject(item.subject, item.teacher);
    subjectListContainer.appendChild(el);
  });
}

function selectSubject(subject, teacher) {
  state.selectedSubject = subject;
  state.searchTerm = ''; // Optional: clear search on select? Let's keep filter if user wants.
  // Actually, usually better to keep context.

  // Update UI
  renderSubjectList(); // To highlight active class

  // Update Header
  selectedContextDisplay.textContent = `${subject} (${teacher})`;

  renderTimetable();
}

function renderTimetable() {
  timetableGrid.innerHTML = `
    <div class="header-cell"></div>
    <div class="header-cell">08:00 - 10:00</div>
    <div class="header-cell">10:00 - 12:00</div>
    <div class="header-cell">01:00 - 03:00</div>
    <div class="header-cell">03:00 - 05:00</div>
  `;

  // Show message only if NO bookings AND NO selected subject
  if (!state.selectedSubject && state.myBookings.length === 0) {
    const msg = document.createElement('div');
    msg.style.gridColumn = "1 / -1";
    msg.style.padding = "3rem";
    msg.style.textAlign = "center";
    msg.style.color = "var(--text-muted)";
    msg.textContent = "Select a subject from the directory to start booking.";
    timetableGrid.appendChild(msg);
    return;
  }

  // Pre-calculate INVALID TEACHERS for the selected subject
  const invalidTeachers = new Set();
  if (state.selectedSubject) {
    // Get all slots for valid teachers of this subject
    const subjectSlots = state.slots.filter(s => getSubjectByTeacher(s.teacher) === state.selectedSubject);
    const teachers = [...new Set(subjectSlots.map(s => s.teacher))];

    teachers.forEach(teacher => {
      const teacherSlots = state.slots.filter(s => s.teacher === teacher);
      const isConflict = teacherSlots.some(tSlot => {
        return state.myBookings.some(booked => {
          // Conflict if same day/time AND different teacher
          if (booked.teacher === teacher) return false; // Don't conflict with self (already booked)
          return booked.day === tSlot.day && normalizeTime(booked.time) === normalizeTime(tSlot.time);
        });
      });
      if (isConflict) invalidTeachers.add(teacher);
    });
  }

  DAYS.forEach(day => {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell';
    dayCell.textContent = day;
    timetableGrid.appendChild(dayCell);

    TIME_SLOTS.forEach(time => {
      const slotCell = document.createElement('div');
      slotCell.className = 'slot-cell';

      // 1. Render user's CONFIRMED bookings for this slot
      const myBookingsForSlot = state.myBookings.filter(b =>
        b.day === day && normalizeTime(b.time) === normalizeTime(time)
      );

      myBookingsForSlot.forEach(booking => {
        const card = createMyBookingCard(booking);
        slotCell.appendChild(card);
      });

      // 2. Render OPTIONS for the selected subject (if not already booked)
      // Check if we already have a booking for this subject
      const isSubjectAlreadyBooked = state.myBookings.some(b => b.subject === state.selectedSubject);

      if (state.selectedSubject && !isSubjectAlreadyBooked) {
        const options = getOptionsForSlot(day, time);

        options.forEach(opt => {
          const isTeacherInvalid = invalidTeachers.has(opt.teacher);
          const card = createSlotCard(opt, isTeacherInvalid);
          slotCell.appendChild(card);
        });
      } else if (state.selectedSubject && isSubjectAlreadyBooked) {
        // Optional: Show placeholder or just nothing to indicate "Done"
      }

      timetableGrid.appendChild(slotCell);
    });
  });
}

function getOptionsForSlot(day, time) {
  if (!state.selectedSubject) return [];

  return state.slots.filter(s => {
    const sTime = normalizeTime(s.time);
    const cTime = normalizeTime(time);
    const sDay = s.day.trim();

    if (sDay !== day || sTime !== cTime) return false;

    const subject = getSubjectByTeacher(s.teacher);
    return subject === state.selectedSubject;
  });
}

function normalizeTime(t) {
  // Remove spaces, leadings zeroes
  return t.replace(/\s/g, '').replace(/^0/, '');
}

function getSubjectByTeacher(teacherName) {
  const data = state.teacherMap[teacherName];
  return data ? data.subject : "Unknown Subject";
}

function createMyBookingCard(booking) {
  const el = document.createElement('div');
  el.className = 'slot-card booked';
  // Add a specific style for "My Booking" if needed, reusing 'booked' for now
  el.style.borderLeft = "4px solid #10b981"; // Extra visual cue

  el.innerHTML = `
    <div class="slot-subject">${booking.subject}</div>
    <div class="slot-teacher">${booking.teacher} (Booked)</div>
  `;
  return el;
}

function createSlotCard(slot, isTeacherInvalid = false) {
  const el = document.createElement('div');
  const subject = getSubjectByTeacher(slot.teacher);

  el.className = 'slot-card';
  el.innerHTML = `
    <div class="slot-subject">${subject}</div>
    <div class="slot-teacher">${slot.teacher}</div>
  `;

  // Check Local Conflict (This specific slot overlaps)
  const directConflict = state.myBookings.find(b => b.day === slot.day && normalizeTime(b.time) === normalizeTime(slot.time));

  // Note: directConflict might be true OR isTeacherInvalid might be true.
  // If directConflict is true, it certainly implies isTeacherInvalid (since we checked all slots).

  if (directConflict || isTeacherInvalid) {
    el.classList.add('conflict');
    if (directConflict) {
      el.title = `Conflict: You already booked ${directConflict.subject} here`;
    } else {
      el.title = `Conflict: This teacher has another class that overlaps with your schedule.`;
    }
  }

  // Check Global Booked Status
  const globalKey = `${slot.teacher}-${slot.day}-${slot.time}`;
  if (state.bookedSlots.has(globalKey)) {
    el.classList.add('booked');
    el.title = "Already booked";
  }

  if (!directConflict && !isTeacherInvalid && !state.bookedSlots.has(globalKey)) {
    el.onclick = () => openBookingModal(slot, subject);
  }

  return el;
}

function openBookingModal(slot, subject) {
  // Double check conflict just in case
  const conflict = state.myBookings.find(b => b.day === slot.day && normalizeTime(b.time) === normalizeTime(slot.time));
  if (conflict) return;

  state.modalTarget = { ...slot, subject };

  modalSubject.textContent = subject;
  modalTeacher.textContent = slot.teacher;
  modalTime.textContent = `${slot.day} @ ${slot.time}`;

  modal.classList.remove('hidden');
  // No input focus needed
}

function closeModal() {
  modal.classList.add('hidden');
  state.modalTarget = null;
}

function handleBookingConfirm() {
  const targetSlot = state.modalTarget;
  if (!targetSlot) return;

  // 1. Find ALL slots for this teacher
  const teacherSlots = state.slots.filter(s => s.teacher === targetSlot.teacher);

  // 2. Check for Conflicts with EXISTING bookings (excluding current teacher if re-booking? Assuming strict add for now)
  // We need to ensure NONE of the teacher's slots overlap with what we already have.
  // We exclude bookings that are already FOR this teacher (idempotency)
  const conflicts = [];

  teacherSlots.forEach(tSlot => {
    const isConflict = state.myBookings.some(booked => {
      // Different teacher, same time
      if (booked.teacher === tSlot.teacher) return false;
      return booked.day === tSlot.day && normalizeTime(booked.time) === normalizeTime(tSlot.time);
    });
    if (isConflict) conflicts.push(tSlot);
  });

  if (conflicts.length > 0) {
    showToast(`Cannot book: Conflicts with existing classes!`, false);
    return;
  }

  // 3. Add ALL slots to state (avoiding duplicates)
  let addedCount = 0;
  teacherSlots.forEach(tSlot => {
    // Check if already booked
    const alreadyBooked = state.myBookings.some(b =>
      b.id === tSlot.id || (b.teacher === tSlot.teacher && b.day === tSlot.day && normalizeTime(b.time) === normalizeTime(tSlot.time))
    );

    if (!alreadyBooked) {
      // Add to Global Mock
      const globalKey = `${tSlot.teacher}-${tSlot.day}-${tSlot.time}`;
      state.bookedSlots.add(globalKey);

      // Add to Local
      state.myBookings.push({
        ...tSlot,
        subject: state.selectedSubject, // Ensure subject is carried over
        bookedAt: new Date().toISOString()
      });
      addedCount++;
    }
  });

  saveLocalBookings();

  // 4. UI Updates
  if (addedCount > 0) {
    showToast(`Booked ${addedCount} slots for ${targetSlot.teacher}`, true);
  } else {
    showToast("Slots already booked", true);
  }

  closeModal();
  renderTimetable();
}

function showToast(msg, isSuccess = true) {
  toast.textContent = msg;
  toast.className = `toast ${isSuccess ? 'success' : 'error'}`;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

async function handleDownloadPDF() {
  const element = document.querySelector('.timetable-section');
  if (!element) return;

  // Visual feedback
  const originalText = downloadBtn.textContent;
  downloadBtn.textContent = 'Generating...';
  downloadBtn.disabled = true;

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      backgroundColor: '#1e1b4b', // Match background
      useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');

    // Landscape A4
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // Center vertically if it fits, else top align
    let yPos = 0;
    if (imgHeight < pdfHeight) {
      yPos = (pdfHeight - imgHeight) / 2;
    }

    pdf.addImage(imgData, 'PNG', 0, yPos, imgWidth, imgHeight);
    pdf.save('my-timetable.pdf');

    showToast("PDF Downloaded!", true);
  } catch (err) {
    console.error(err);
    showToast("Failed to generate PDF", false);
  } finally {
    downloadBtn.textContent = originalText;
    downloadBtn.disabled = false;
  }
}

init();
