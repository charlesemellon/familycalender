// Supabase cloud layer for Family Calendar.

const SUPABASE_CONFIG =
  window.FAMILY_CALENDAR_SUPABASE || { url: "", key: "" };

let supa = null;
let cloudReady = false;
let cloudFamily = null;
let cloudProfile = null;

function cloudConfigured() {
  return (
    SUPABASE_CONFIG.url.startsWith("http") &&
    !SUPABASE_CONFIG.url.includes("YOUR_") &&
    !SUPABASE_CONFIG.key.includes("YOUR_")
  );
}

function cloudErrorMessage(e) {
  return e?.message || e?.error_description || String(e);
}

function replaceAuthUI() {
  const el = document.getElementById("authScreen");
  if (!el) return;

  el.innerHTML = `
    <div class="auth-card">
      <div class="brand">
        <div class="logo">✓</div>
        <span>Our Family Calendar</span>
      </div>

      <h1 id="authTitle" style="margin-top:20px">Sign in</h1>
      <p id="authHelp">Sign in to your family account.</p>

      <div class="auth-tabs">
        <button id="loginTab" class="auth-tab active"
          onclick="cloudShowAuth('login')">Sign In</button>

        <button id="createTab" class="auth-tab"
          onclick="cloudShowAuth('create')">Create Family</button>

        <button id="joinTab" class="auth-tab"
          onclick="cloudShowAuth('join')">Join Family</button>
      </div>

      <div id="cloudLoginForm">
        <div class="field">
          <label>EMAIL</label>
          <input id="cloudLoginEmail" type="email"
            placeholder="you@example.com">
        </div>

        <div class="field" style="margin-top:12px">
          <label>PASSWORD</label>
          <input id="cloudLoginPassword" type="password"
            placeholder="Password">
        </div>
      </div>

      <div id="cloudCreateForm" style="display:none">
        <div class="field">
          <label>FAMILY NAME</label>
          <input id="cloudFamilyName"
            placeholder="The Smith Family">
        </div>

        <div class="field" style="margin-top:12px">
          <label>YOUR NAME</label>
          <input id="cloudCreateName"
            placeholder="Mom">
        </div>

        <div class="field" style="margin-top:12px">
          <label>EMAIL</label>
          <input id="cloudCreateEmail"
            type="email"
            placeholder="mom@example.com">
        </div>

        <div class="field" style="margin-top:12px">
          <label>PASSWORD</label>
          <input id="cloudCreatePassword"
            type="password"
            placeholder="Create a password">
        </div>
      </div>

      <div id="cloudJoinForm" style="display:none">
        <div class="field">
          <label>YOUR NAME</label>
          <input id="cloudJoinName"
            placeholder="Kid 1">
        </div>

        <div class="field" style="margin-top:12px">
          <label>EMAIL</label>
          <input id="cloudJoinEmail"
            type="email"
            placeholder="kid@example.com">
        </div>

        <div class="field" style="margin-top:12px">
          <label>PASSWORD</label>
          <input id="cloudJoinPassword"
            type="password"
            placeholder="Create a password">
        </div>

        <div class="field" style="margin-top:12px">
          <label>FAMILY CODE OR INVITE CODE</label>
          <input id="cloudJoinCode"
            placeholder="8-character code"
            autocapitalize="characters">
        </div>

        <div class="helper">
          Your account is permanently tied to the family it joins.
          There is no switch-family option for kids.
        </div>
      </div>

      <div class="auth-actions">
        <button class="save"
          onclick="cloudSubmitAuth()"
          id="cloudAuthSubmit">
          Sign In
        </button>
      </div>

      <div id="cloudAuthError"
        style="color:#c33;font-size:12px;margin-top:10px">
      </div>

      <div id="cloudSetupHint"
        style="font-size:12px;color:#666;margin-top:14px">
      </div>
    </div>
  `;
}

function cloudShowAuth(mode) {
  ["cloudLoginForm", "cloudCreateForm", "cloudJoinForm"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

  const form =
    mode === "login"
      ? "cloudLoginForm"
      : mode === "create"
      ? "cloudCreateForm"
      : "cloudJoinForm";

  document.getElementById(form).style.display = "block";

  document.getElementById("loginTab")
    .classList.toggle("active", mode === "login");

  document.getElementById("createTab")
    .classList.toggle("active", mode === "create");

  document.getElementById("joinTab")
    .classList.toggle("active", mode === "join");

  document.getElementById("authTitle").textContent =
    mode === "login"
      ? "Sign in"
      : mode === "create"
      ? "Create your family"
      : "Join a family";

  document.getElementById("authHelp").textContent =
    mode === "login"
      ? "Sign in to your family account."
      : mode === "create"
      ? "Create the family and become the first parent."
      : "Use the family code or a one-time invite code from a parent.";

  document.getElementById("cloudAuthSubmit").textContent =
    mode === "login"
      ? "Sign In"
      : mode === "create"
      ? "Create Family"
      : "Join Family";

  document.getElementById("cloudAuthError").textContent = "";
}

async function cloudSubmitAuth() {
  const err = document.getElementById("cloudAuthError");
  err.textContent = "";

  if (!cloudReady) {
    err.textContent =
      "Connect this site to Supabase first.";
    return;
  }

  const mode =
    document.getElementById("loginTab").classList.contains("active")
      ? "login"
      : document.getElementById("createTab").classList.contains("active")
      ? "create"
      : "join";

  try {
    if (mode === "login") {
      const email =
        document.getElementById("cloudLoginEmail")
          .value.trim().toLowerCase();

      const password =
        document.getElementById("cloudLoginPassword").value;

      const { error } =
        await supa.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

    } else if (mode === "create") {

      const familyName =
        document.getElementById("cloudFamilyName")
          .value.trim();

      const name =
        document.getElementById("cloudCreateName")
          .value.trim();

      const email =
        document.getElementById("cloudCreateEmail")
          .value.trim()
          .toLowerCase();

      const password =
        document.getElementById("cloudCreatePassword")
          .value;

      if (
        !familyName ||
        !name ||
        !email ||
        password.length < 6
      ) {
        throw new Error(
          "Enter every field and use a password with at least 6 characters."
        );
      }

      const { data, error } =
        await supa.auth.signUp({
          email,
          password
        });

      if (error) throw error;

      if (!data.session) {
        throw new Error(
          "Email confirmation is enabled. Turn off email confirmation in Supabase Auth settings."
        );
      }

      const { data: family, error: familyError } =
        await supa.rpc("create_family", {
          p_family_name: familyName,
          p_person_name: name
        });

      if (familyError) throw familyError;

      alert(
        "Family created! Your family code is " +
        family.family_code
      );

    } else {

      const name =
        document.getElementById("cloudJoinName")
          .value.trim();

      const email =
        document.getElementById("cloudJoinEmail")
          .value.trim()
          .toLowerCase();

      const password =
        document.getElementById("cloudJoinPassword")
          .value;

      const code =
        document.getElementById("cloudJoinCode")
          .value.trim()
          .toUpperCase();

      if (
        !name ||
        !email ||
        password.length < 6 ||
        !code
      ) {
        throw new Error(
          "Enter every field and use a password with at least 6 characters."
        );
      }

      const { data, error } =
        await supa.auth.signUp({
          email,
          password
        });

      if (error) throw error;

      if (!data.session) {
        throw new Error(
          "Email confirmation is enabled. Turn off email confirmation in Supabase Auth settings."
        );
      }

      const { error: joinError } =
        await supa.rpc("join_family", {
          p_code: code,
          p_person_name: name
        });

      if (joinError) throw joinError;
    }

    await cloudStart();

  } catch (e) {
    err.textContent = cloudErrorMessage(e);
  }
}

async function cloudStart() {

  const {
    data: { session }
  } = await supa.auth.getSession();

  if (!session) {
    document.getElementById("authScreen").style.display = "flex";
    cloudShowAuth("login");
    return;
  }

  const {
    data: profile,
    error
  } =
    await supa
      .from("profiles")
      .select("user_id,family_id,name,role,color")
      .eq("user_id", session.user.id)
      .maybeSingle();

  if (error) throw error;

  if (!profile) {
    document.getElementById("authScreen").style.display = "flex";
    cloudShowAuth("join");
    return;
  }

  cloudProfile = profile;

  const {
    data: family,
    error: familyError
  } =
    await supa
      .from("families")
      .select("id,name,family_code")
      .eq("id", profile.family_id)
      .single();

  if (familyError) throw familyError;

  cloudFamily = family;

  currentUser = {
    id: profile.user_id,
    name: profile.name,
    email: session.user.email,
    role: profile.role,
    color: profile.color,
    familyId: profile.family_id
  };

  await loadCloudData();

  document.getElementById("authScreen").style.display = "none";

  syncPeopleFromFamily();

  currentPage =
    profile.role === "parent"
      ? "all"
      : profile.user_id;

  const addButton =
    document.querySelector(".add-btn");

  if (addButton) {
    addButton.style.display =
      isParent() ? "inline-block" : "none";
  }

  document.getElementById("familyBadge").textContent =
    family.name +
    " · " +
    (isParent() ? "Parent" : "Kid");

  renderFamily();
  renderCalendar();
  renderTodos();
  showFamilyTools();
}

async function loadCloudData() {

  const fid = cloudFamily.id;

  const {
    data: profiles,
    error: profileError
  } =
    await supa
      .from("profiles")
      .select("user_id,name,role,color,created_at")
      .eq("family_id", fid)
      .order("created_at");

  if (profileError) throw profileError;

  people.length = 0;

  profiles.forEach(p => {
    people.push({
      id: p.user_id,
      name: p.name,
      color: p.color || "#5b67f1",
      role: p.role
    });
  });

  filters =
    Object.fromEntries(
      people.map(p => [p.id, true])
    );

  const {
    data: es,
    error: eventError
  } =
    await supa
      .from("events")
      .select("*")
      .eq("family_id", fid);

  if (eventError) throw eventError;

  events =
    (es || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time || "",
      endTime: e.end_time || "",
      people: e.people || [],
      type: e.type || "Family",
      notes: e.notes || "",
      repeat: e.repeat_rule || "none",
      repeatDays: e.repeat_days || []
    }));

  const {
    data: ts,
    error: taskError
  } =
    await supa
      .from("tasks")
      .select("*")
      .eq("family_id", fid);

  if (taskError) throw taskError;

  tasks =
    (ts || []).map(t => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      people: t.people || [],
      completed: !!t.completed
    }));

  const { data: completions } =
    await supa
      .from("event_completions")
      .select("event_id,completed")
      .eq("user_id", currentUser.id);

  completedEvents =
    Object.fromEntries(
      (completions || [])
        .map(c => [c.event_id, c.completed])
    );
}

async function saveData() {

  if (!cloudReady || !cloudFamily || !currentUser)
    return;

  const fid = cloudFamily.id;

  const eventRows =
    events.map(e => ({
      id: e.id,
      family_id: fid,
      title: e.title,
      date: e.date,
      time: e.time || null,
      end_time: e.endTime || null,
      people: e.people || [],
      type: e.type || "Family",
      notes: e.notes || "",
      repeat_rule: e.repeat || "none",
      repeat_days: e.repeatDays || [],
      updated_at: new Date().toISOString()
    }));

  const taskRows =
    tasks.map(t => ({
      id: t.id,
      family_id: fid,
      title: t.title,
      due_date: t.dueDate,
      people: t.people || [],
      completed: !!t.completed,
      updated_at: new Date().toISOString()
    }));

  const { data: remoteEvents } =
    await supa
      .from("events")
      .select("id")
      .eq("family_id", fid);

  const localEventIds =
    new Set(events.map(e => e.id));

  const removeEvents =
    (remoteEvents || [])
      .map(x => x.id)
      .filter(id => !localEventIds.has(id));

  if (removeEvents.length) {
    const { error } = await supa.from("events").delete().in("id", removeEvents);
    if (error) throw error;
  }
  if (eventRows.length) {
    const { error } = await supa.from("events").upsert(eventRows);
    if (error) throw error;
  }

  if (isParent()) {

    const { data: remoteTasks } =
      await supa
        .from("tasks")
        .select("id")
        .eq("family_id", fid);

    const localTaskIds =
      new Set(tasks.map(t => t.id));

    const removeTasks =
      (remoteTasks || [])
        .map(x => x.id)
        .filter(id => !localTaskIds.has(id));

    if (removeTasks.length) {
      const { error } = await supa.from("tasks").delete().in("id", removeTasks);
      if (error) throw error;
    }
    if (taskRows.length) {
      const { error } = await supa.from("tasks").upsert(taskRows);
      if (error) throw error;
    }
  }
}

async function cloudToggleEventDone(id, done) {

  const { error } =
    await supa.rpc("set_event_completed", {
      p_event_id: id,
      p_completed: done
    });

  if (error) {
    alert(error.message);
    return;
  }

  completedEvents[id] = done;
  renderTodos();
}

async function cloudToggleTaskDone(id, done) {

  const { error } =
    await supa.rpc("set_task_completed", {
      p_task_id: id,
      p_completed: done
    });

  if (error) {
    alert(error.message);
    return;
  }

  const task = tasks.find(x => x.id === id);

  if (task)
    task.completed = done;

  renderTodos();
}


function cloudRenderFamily() {
  const visible = people.filter(p => isParent() || p.id === currentUser?.id);
  const familyList = document.getElementById("familyList");
  if (familyList) {
    familyList.innerHTML = visible.map(p => `
      <div class="family" onclick="setPage('${p.id}')">
        <span class="dot" style="background:${p.color}"></span>
        <span class="family-name">${escapeHtml(p.name)}</span>
        ${isParent() ? `<button class="rename-btn" onclick="event.stopPropagation(); renamePerson('${p.id}')">Edit</button>` : ""}
      </div>
    `).join("");
  }
  const pickerPeople = isParent() ? people : people.filter(p => p.id === currentUser.id);
  const picker = document.getElementById("peoplePicker");
  if (picker) picker.innerHTML = pickerPeople.map(p => `
    <label class="person-chip" id="chip-${p.id}">
      <input type="checkbox" class="person-check" value="${p.id}">
      <span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}
    </label>`).join("");
  const taskPicker = document.getElementById("taskPeoplePicker");
  if (taskPicker) taskPicker.innerHTML = pickerPeople.map(p => `
    <label class="person-chip">
      <input type="checkbox" class="task-person-check" value="${p.id}">
      <span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}
    </label>`).join("");
  const pages = document.getElementById("pages");
  if (pages) pages.innerHTML =
    (isParent() ? `<button class="page-btn ${currentPage === "all" ? "active" : ""}" onclick="setPage('all')">Everyone</button>` : "") +
    visible.map(p => `
      <button class="page-btn ${currentPage === p.id ? "active" : ""}" onclick="setPage('${p.id}')">
        <span class="dot" style="display:inline-block;background:${p.color};margin-right:6px;vertical-align:middle"></span>${escapeHtml(p.name)}
      </button>`).join("");
}
window.renderFamily = cloudRenderFamily;


function showFamilyTools() {
  let box = document.getElementById("cloudFamilyTools");
  if (!box) {
    box = document.createElement("div");
    box.id = "cloudFamilyTools";
    box.className = "mini-card";
    const aside = document.querySelector("aside");
    if (aside) aside.appendChild(box);
  }
  if (!cloudFamily) return;
  if (isParent()) {
    box.innerHTML = `
      <strong>Family</strong>
      <p>Family code: <b style="font-size:16px;letter-spacing:1px">${escapeHtml(cloudFamily.family_code)}</b></p>
      <button class="add-member-btn" onclick="copyFamilyCode()">Copy Family Code</button>
      <button class="add-member-btn" onclick="createInvite('kid')">＋ Create Kid Invite</button>
      <button class="add-member-btn" onclick="createInvite('parent')" style="margin-top:6px">＋ Create Parent Invite</button>
      <div id="inviteResult" style="font-size:12px;margin-top:8px"></div>
      <div id="activeInvites" style="font-size:11px;margin-top:10px"></div>
      <p style="font-size:11px;color:#777;margin-bottom:0">Invite codes expire after 7 days and can only be used once. People who join are permanently tied to this family.</p>
    `;
    loadActiveInvites();
  } else {
    box.innerHTML = `
      <strong>Family</strong>
      <p>${escapeHtml(cloudFamily.name)}</p>
      <p style="font-size:11px;color:#777">Your account is locked to this family.</p>
    `;
  }
}
async function copyFamilyCode() {
  const code = cloudFamily?.family_code;
  if (!code) return;
  try { await navigator.clipboard.writeText(code); }
  catch {}
  const out = document.getElementById("inviteResult");
  if (out) out.textContent = "Family code copied.";
}
async function loadActiveInvites() {
  const out = document.getElementById("activeInvites");
  if (!out || !isParent() || !cloudFamily) return;
  const { data, error } = await supa.from("family_invites")
    .select("code,role,expires_at").eq("family_id", cloudFamily.id)
    .is("used_at", null).order("created_at", { ascending: false });
  if (error) { out.textContent = ""; return; }
  const active = (data || []).filter(x => new Date(x.expires_at) > new Date());
  if (!active.length) { out.innerHTML = "<span style='color:#777'>No active invites.</span>"; return; }
  out.innerHTML = "<b>Active invites</b>" + active.map(x => `
    <div style="margin-top:6px;display:flex;justify-content:space-between;gap:6px;align-items:center">
      <span>${escapeHtml(x.role)}: <b style="letter-spacing:1px">${escapeHtml(x.code)}</b></span>
      <button class="rename-btn" onclick="copyInviteCode('${x.code}')">Copy</button>
    </div>`).join("");
}
async function copyInviteCode(code) {
  try { await navigator.clipboard.writeText(code); } catch {}
  const out = document.getElementById("inviteResult");
  if (out) out.textContent = "Invite code copied.";
}
async function createInvite(role) {
  const out = document.getElementById("inviteResult");
  if (!isParent()) return;
  const { data, error } = await supa.rpc("create_family_invite", { p_role: role });
  if (error) { if (out) out.textContent = error.message; return; }
  if (out) out.innerHTML = `Share this <b>${escapeHtml(role)}</b> invite code: <b style="font-size:16px;letter-spacing:1px">${escapeHtml(data)}</b> <button class="rename-btn" onclick="copyInviteCode('${data}')">Copy</button>`;
  await loadActiveInvites();
}

function cloudLogout() {

  supa.auth.signOut();

  location.reload();
}

async function cloudOverrideSaveProfile() {
  const id = document.getElementById("profileBackdrop").dataset.personId;
  const name = document.getElementById("profileName").value.trim();
  const color = document.getElementById("profileColor").value;
  const role = document.getElementById("profileRole").value;

  if (!["parent","kid"].includes(role)) return alert("Invalid role.");
  if (!name) return alert("Please enter a name.");
  if (!isParent()) return;

  const target = people.find(x => x.id === id);
  if (!target) return alert("Family member not found.");

  // A parent can rename/recolor any member and promote a kid to parent.
  // Do not allow the last parent to be changed into a kid.
  if (target.role === "parent" && role === "kid") {
    const parentCount = people.filter(x => x.role === "parent").length;
    if (parentCount <= 1) return alert("The family must always have at least one parent.");
  }

  const { error } = await supa.rpc("update_family_member", {
    p_user_id: id,
    p_name: name,
    p_color: color,
    p_role: role
  });

  if (error) return alert(error.message);

  await loadCloudData();
  if (currentUser.id === id) {
    currentUser.name = name;
    currentUser.color = color;
    currentUser.role = role;
  }

  closeProfileModal();
  currentPage = isParent() ? (currentPage === id ? id : "all") : currentUser.id;
  renderFamily();
  renderCalendar();
  renderTodos();
  showFamilyTools();
}

async function cloudSaveData() {
  try { await saveData(); }
  catch (e) { console.error(e); alert("Could not save to the family cloud: " + cloudErrorMessage(e)); }
}
window.cloudSaveData = cloudSaveData;

async function cloudBoot() {

  replaceAuthUI();

  if (!cloudConfigured()) {

    document.getElementById(
      "cloudSetupHint"
    ).innerHTML =
      "Supabase configuration is missing.";

    document.getElementById(
      "authScreen"
    ).style.display = "flex";

    cloudShowAuth("login");

    return;
  }

  supa =
    window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.key,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

  cloudReady = true;

  supa.auth.onAuthStateChange(() => {

    setTimeout(() => {

      cloudStart()
        .catch(e => console.error(e));

    }, 0);
  });

  try {

    await cloudStart();

  } catch (e) {

    console.error(e);

    document.getElementById(
      "authScreen"
    ).style.display = "flex";

    document.getElementById(
      "cloudAuthError"
    ).textContent =
      cloudErrorMessage(e);
  }
}

// Supabase versions of the old functions.
window.logout = cloudLogout;
window.saveProfile = cloudOverrideSaveProfile;
window.toggleEventDone = cloudToggleEventDone;
window.toggleTaskDone = cloudToggleTaskDone;
window.submitAuth = cloudSubmitAuth;
window.showAuth = cloudShowAuth;
window.startFamilyApp = cloudStart;

window.addFamilyMember = function () {
  if (isParent())
    showFamilyTools();
};

window.addEventListener(
  "load",
  () => cloudBoot()
);
