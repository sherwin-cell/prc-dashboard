import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { LuSearch, LuEye, LuArchive, LuTrash2, LuCheck, LuArrowLeft } from "react-icons/lu";
import ArchivedUsersPage from "../../pages/ArchivedUsersPage"; // Import the separate archive view

const UsersPage = () => {
  const [viewMode, setViewMode] = useState("active"); // 'active' | 'archived' | 'detail'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  
  // View & Action States
  const [selectedUser, setSelectedUser] = useState(null);
  const [banner, setBanner] = useState({ show: false, message: "" });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, actionType: null, user: null });

  // Comprehensive mapping of Municipalities and their Barangays
  const municipalityBarangays = {
    Barcelona: ["Alegria", "Bagacay", "Bangate", "Bugtong", "Cagang", "Fabrica", "Jibong", "Lago", "Layog", "Luneta", "Macabari", "Mapapac", "Olandia", "Paghaluban", "Poblacion Central", "Poblacion Norte", "Poblacion Sur", "Putiao", "San Antonio", "San Isidro", "San Ramon", "San Vicente", "Santa Cruz", "Santa Lourdes", "Tagdon"],
    Bulan: ["A. Bonifacio", "Abad Santos", "Aguinaldo", "Antipolo", "Beguin", "Benigno S. Aquino", "Bical", "Bonga", "Butag", "Cadandanan", "Calomagon", "Calpi", "Cocok-Cabitan", "Daganas", "Danao", "Dolos", "E. Quirino", "Fabrica", "G. del Pilar", "Gate", "Inararan", "J. Gerona", "J. P. Laurel", "Jamorawon", "Lajong", "Libertad", "M. Roxas", "Magsaysay", "Managanaga", "Marinab", "Montecalvario", "N. Roque", "Namo", "Nasuje", "Obrero", "Osmeña", "Otavi", "Padre Diaz", "Palale", "Quezon", "R. Gerona", "Recto", "Sagrada", "San Francisco", "San Isidro", "San Juan Bag-o", "San Juan Daan", "San Rafael", "San Ramon", "San Vicente", "Santa Remedios", "Santa Teresita", "Sigad", "Somagongsong", "Taromata", "Zone I Poblacion", "Zone II Poblacion", "Zone III Poblacion", "Zone IV Poblacion", "Zone V Poblacion", "Zone VI Poblacion", "Zone VII Poblacion", "Zone VIII Poblacion"],
    Bulusan: ["Bagacay", "Central", "Cogon", "Dancalan", "Dapdap", "Lalud", "Looban", "Mabuhay", "Madlawon", "Poctol", "Porog", "Sabang", "Salvacion", "San Antonio", "San Bernardo", "San Francisco", "San Isidro", "San Jose", "San Rafael", "San Roque", "San Vicente", "Santa Barbara", "Sapngan", "Tinampo"],
    Casiguran: ["Adovis", "Boton", "Burgos", "Casay", "Cawit", "Central", "Cogon", "Colambis", "Escuala", "Inlagadian", "Lungib", "Mabini", "Ponong", "Rizal", "San Antonio", "San Isidro", "San Juan", "San Pascual", "Santa Cruz", "Somal-ot", "Tigbao", "Timbayog", "Tiris", "Trece Martirez", "Tulay"],
    Castilla: ["Amomonting", "Bagalayag", "Bagong Sirang", "Bonga", "Buenavista", "Burabod", "Caburacan", "Canjela", "Cogon", "Cumadcad", "Dangcalan", "Dinapa", "La Union", "Libtong", "Loreto", "Macalaya", "Maracabac", "Mayon", "Maypangi", "Milagrosa", "Miluya", "Monte Carmelo", "Oras", "Pandan", "Poblacion", "Quirapi", "Saclayan", "Salvacion", "San Isidro", "San Rafael", "San Roque", "San Vicente", "Sogoy", "Tomalaytay"],
    Donsol: ["Alin", "Awai", "Banban", "Bandi", "Banuang Gurang", "Baras", "Bayawas", "Bororan Barangay 1", "Cabugao", "Central Barangay 2", "Cristo", "Dancalan", "De Vera", "Gimagaan", "Girawan", "Gogon", "Gura", "Juan Adre", "Lourdes", "Mabini", "Malapoc", "Malinao", "Market Site Barangay 3", "New Maguisa", "Ogod", "Old Maguisa", "Orange", "Pangpang", "Parina", "Pawala", "Pinamanaan", "Poso Poblacion", "Punta Waling-Waling Poblacion", "Rawis", "San Antonio", "San Isidro", "San Jose", "San Rafael", "San Ramon", "San Vicente", "Santa Cruz", "Sevilla", "Sibago", "Suguian", "Tagbac", "Tinanogan", "Tongdol", "Tres Marias", "Tuba", "Tupas", "Vinisitahan"],
    Gubat: ["Ariman", "Bagacay", "Balud del Norte", "Balud del Sur", "Benguet", "Bentuco", "Beriran", "Buenavista", "Bulacao", "Cabigaan", "Cabiguhan", "Carriedo", "Casili", "Cogon", "Cota na Daco", "Dita", "Jupi", "Lapinig", "Luna-Candol", "Manapao", "Manook", "Naagtan", "Nato", "Nazareno", "Ogao", "Paco", "Panganiban", "Paradijon", "Patag", "Payawin", "Pinontingan", "Rizal", "San Ignacio", "Sangat", "Santa Ana", "Tabi", "Tagaytay", "Tigkiw", "Tiris", "Togawe", "Union", "Villareal"],
    Irosin: ["Bacolod", "Bagsangan", "Batang", "Bolos", "Buenavista", "Bulawan", "Carriedo", "Casini", "Cawayan", "Cogon", "Gabao", "Gulang-Gulang", "Gumapia", "Liang", "Macawayan", "Mapaso", "Monbon", "Patag", "Salvacion", "San Agustin", "San Isidro", "San Juan", "San Julian", "San Pedro", "Santo Domingo", "Tabon-Tabon", "Tinampo", "Tongdol"],
    Juban: ["Anog", "Aroroy", "Bacolod", "Binanuahan", "Biriran", "Buraburan", "Calateo", "Calmayon", "Carohayon", "Catanagan", "Catanusan", "Cogon", "Embarcadero", "Guruyan", "Lajong", "Maalo", "North Poblacion", "Puting Sapa", "Rangas", "Sablayan", "Sipaya", "South Poblacion", "Taboc", "Tinago", "Tughan"],
    Magallanes: ["Aguada Norte", "Aguada Sur", "Anibong", "Bacalon", "Bacolod", "Banacud", "Behia", "Biga", "Binisitahan del Norte", "Binisitahan del Sur", "Biton", "Bulala", "Busay", "Caditaan", "Cagbolo", "Cagtalaba", "Cawit Extension", "Cawit Proper", "Ginangra", "Hubo", "Incarizan", "Lapinig", "Magsaysay", "Malbog", "Pantalan", "Pawik", "Pili", "Poblacion", "Salvacion", "Santa Elena", "Siuton", "Tagas", "Tulatula Norte", "Tulatula Sur"],
    Matnog: ["Balocawe", "Banogao", "Banuangdaan", "Bariis", "Bolo", "Bon-ot Big", "Bon-ot Small", "Cabagahan", "Calayuan", "Calintaan", "Caloocan", "Calpi", "Camachiles", "Camcaman", "Coron-coron", "Culasi", "Gadgaron", "Genablan Occidental", "Genablan Oriental", "Hidhid", "Laboy", "Lajong", "Mambajog", "Manjunlad", "Manurabi", "Naburacan", "Paghuliran", "Pangi", "Pawa", "Poropandan", "Santa Isabel", "Sinalmacan", "Sinang-atan", "Sinibaran", "Sisigon", "Sua", "Sulangan", "Tablac", "Tabunan", "Tugas"],
    Pilar: ["Abas", "Abucay", "Bantayan", "Banuyo", "Bayasong", "Bayawas", "Binanuahan", "Cabiguan", "Cagdongon", "Calongay", "Calpi", "Catamlangan", "Comapo-capo", "Danlog", "Dao", "Dapdap", "Del Rosario", "Esmerada", "Esperanza", "Ginablan", "Guiron", "Inang", "Inapugan", "Leona", "Lipason", "Lourdes", "Lubiano", "Lumbang", "Lungib", "Mabanate", "Malbog", "Marifosque", "Mercedes", "Migabod", "Naspi", "Palanas", "Pangpang", "Pinagsalog", "Pineda", "Poctol", "Pudo", "Putiao", "Sacnangan", "Salvacion", "San Antonio (Millabas)", "San Antonio (Sapa)", "San Jose", "San Rafael", "Santa Fe"],
    "Prieto Diaz": ["Brillante", "Bulawan", "Calao", "Carayat", "Diamante", "Gogon", "Lupi", "Maningcay de Oro", "Manlabong", "Perlas", "Quidolog", "Rizal", "San Antonio", "San Fernando", "San Isidro", "San Juan", "San Rafael", "San Ramon", "Santa Lourdes", "Santo Domingo", "Talisayan", "Tupaz", "Ulag"],
    Sorsogon: ["Abuyog", "Almendras-Cogon", "Balete", "Balogo (Bacon District)", "Balogo (Sorsogon East District)", "Barayong", "Basud", "Bato", "Bibincahan", "Bitan-o/Dalipay", "Bogña", "Bon-ot", "Bucalbucalan", "Buenavista", "Buenavista (Bacon District)", "Buhatan", "Bulabog", "Burabod", "Cabarbuhan", "Cabid-an", "Cambulaga", "Capuy", "Caricaran", "Del Rosario", "Gatbo", "Gimaloto", "Guinlajon", "Jamislagan", "Macabog", "Maricrum", "Marinas", "Osiao", "Pamurayan", "Pangpang", "Panlayaan", "Peñafrancia", "Piot", "Poblacion", "Polvorista", "Rawis", "Rizal", "Salog", "Salvacion", "Salvacion (Bacon District)", "Sampaloc", "San Isidro", "San Isidro (Bacon District)", "San Juan (Bacon District)", "San Juan (Roro)", "San Pascual", "San Ramon", "San Roque", "San Vicente", "Santa Cruz", "Santa Lucia", "Santo Domingo", "Santo Niño", "Sawanga", "Sirangan", "Sugod", "Sulucan", "Talisay", "Ticol", "Tugos"],
    "Sta. Magdalena": ["Barangay Poblacion I", "Barangay Poblacion II", "Barangay Poblacion III", "Barangay Poblacion IV", "La Esperanza", "Peñafrancia", "Salvacion", "San Antonio", "San Bartolome", "San Eugenio", "San Isidro", "San Rafael", "San Roque", "San Sebastian"]
  };

  const municipalitiesList = Object.keys(municipalityBarangays);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const userList = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((user) => user.status !== "archived");

        setUsers(userList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const handleConfirmAction = async () => {
    const { actionType, user } = confirmModal;
    if (!actionType || !user) return;

    try {
      if (actionType === 'archive') {
        await updateDoc(doc(db, 'users', user.id), { status: 'archived', updatedAt: serverTimestamp() });
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setBanner({ show: true, message: `Successfully archived user: ${user.fullname || user.email}` });
      } else if (actionType === 'delete') {
        await deleteDoc(doc(db, 'users', user.id));
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setBanner({ show: true, message: `Permanently deleted user: ${user.fullname || user.email}` });
      }
      setTimeout(() => setBanner({ show: false, message: "" }), 4000);
      setConfirmModal({ isOpen: false, actionType: null, user: null });
    } catch (error) {
      console.error(`Error during ${actionType}:`, error);
      alert(`Failed to ${actionType} user.`);
    }
  };

  const filteredUsers = users.filter((user) => {
    const name = (user.fullname || user.fullName || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const userMuni = (user.municipality || "").toLowerCase();
    const userBrgy = (user.barangay || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    if (selectedMunicipality && userMuni !== selectedMunicipality.toLowerCase()) return false;
    if (selectedBarangay && userBrgy !== selectedBarangay.toLowerCase()) return false;
    
    if (query) {
      return name.includes(query) || email.includes(query) || userMuni.includes(query) || userBrgy.includes(query);
    }
    return true;
  });

  // Render separate Archived View
  if (viewMode === "archived") {
    return <ArchivedUsersPage onBack={() => setViewMode("active")} />;
  }

  // Detailed View Render
  if (selectedUser) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <button
            onClick={() => setSelectedUser(null)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
            title="Back to List"
          >
            <LuArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">User Profile</h1>
            <p className="text-xs text-gray-500">Detailed overview of registered account</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-xl text-gray-900">{selectedUser.fullname || selectedUser.fullName || "N/A"}</h3>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
            </div>
            <span className={`px-3 py-1 text-xs font-extrabold rounded-full uppercase border ${
              selectedUser.role === 'admin' ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-blue-50 text-blue-800 border-blue-100'
            }`}>
              {selectedUser.role || "user"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <strong className="text-gray-700 block mb-0.5">Municipality:</strong>
              <span className="text-gray-900 font-medium">{selectedUser.municipality || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Barangay:</strong>
              <span className="text-gray-900 font-medium">{selectedUser.barangay || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Blood Type:</strong>
              <span className="text-[#D32F2F] font-bold">{selectedUser.bloodType || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Contact Number:</strong>
              <span className="text-gray-900 font-medium">{selectedUser.contactNumber || selectedUser.phone || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-gray-500 font-medium">Loading users...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs transition-all">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active Users</h1>
          <p className="text-xs text-gray-500">Manage and view all registered system users and admins</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Button to navigate to Archived Users */}
          <button
            onClick={() => setViewMode("archived")}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
          >
            <LuArchive size={15} /> Archived Users
          </button>

          {/* Municipality Dropdown */}
          <select
            value={selectedMunicipality}
            onChange={(e) => {
              setSelectedMunicipality(e.target.value);
              setSelectedBarangay("");
            }}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:bg-white focus:border-red-500 font-medium cursor-pointer"
          >
            <option value="">All Municipalities</option>
            {municipalitiesList.map((mun) => (
              <option key={mun} value={mun}>{mun}</option>
            ))}
          </select>

          {/* Barangay Dropdown */}
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            disabled={!selectedMunicipality}
            className={`bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:bg-white focus:border-red-500 font-medium cursor-pointer ${
              !selectedMunicipality ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <option value="">{selectedMunicipality ? "All Barangays" : "Select Municipality first"}</option>
            {selectedMunicipality && municipalityBarangays[selectedMunicipality]?.map((brgy) => (
              <option key={brgy} value={brgy}>{brgy}</option>
            ))}
          </select>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <LuSearch size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user or email..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-red-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-xs rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                <th className="p-4 pl-6">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Location</th>
                <th className="p-4">Role</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-sm font-semibold text-gray-400">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} onClick={() => setSelectedUser(user)} className="hover:bg-gray-50/80 transition-colors cursor-pointer">
                    <td className="p-4 pl-6 font-semibold text-gray-900 whitespace-nowrap">
                      {user.fullname || user.fullName || "N/A"}
                    </td>
                    <td className="p-4 whitespace-nowrap">{user.email || "N/A"}</td>
                    <td className="p-4 whitespace-nowrap">{user.barangay}, {user.municipality}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-full ${
                        user.role === 'admin' ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role || "user"}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button title="View Details" onClick={() => setSelectedUser(user)} className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-gray-500">
                          <LuEye size={17} />
                        </button>
                        <button title="Archive User" onClick={() => setConfirmModal({ isOpen: true, actionType: 'archive', user })} className="p-1.5 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                          <LuArchive size={17} />
                        </button>
                        <button title="Delete Permanently" onClick={() => setConfirmModal({ isOpen: true, actionType: 'delete', user })} className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-gray-500">
                          <LuTrash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 capitalize">Confirm {confirmModal.actionType}</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{confirmModal.actionType}</span> the user account for{" "}
              <span className="font-semibold text-gray-900">{confirmModal.user?.fullname || confirmModal.user?.email}</span>?
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setConfirmModal({ isOpen: false, actionType: null, user: null })} className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmAction} className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${confirmModal.actionType === 'delete' ? "bg-rose-600 hover:bg-rose-700" : "bg-gray-900 hover:bg-gray-800"}`}>
                Yes, {confirmModal.actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;