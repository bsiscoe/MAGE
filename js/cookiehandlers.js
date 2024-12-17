/////////////////////
// COOKIE HANDLERS //
/////////////////////

export function saveShaderToCookie(data) {
    const cookieValue = JSON.stringify(data);  // Convert the object to a JSON string
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 30); // using_cookie_data expires in 30 minutes
    document.cookie = `visualizer=${encodeURIComponent(cookieValue)}; expires=${expirationDate.toUTCString()}; path=/`;
  }
  
export function getCookie(name) {
    const nameEq = name + "=";
    const cookies = document.cookie.split(";");
  
    for (let i = 0; i < cookies.length; i++) {
        let c = cookies[i].trim();
        if (c.indexOf(nameEq) === 0) {
            return decodeURIComponent(c.substring(nameEq.length, c.length));
        }
    }
    return null; // Return null if cookie is not found
  }
  
export function restoreShaderFromCookie() {
    if (cookieData) {
        const restoredData = JSON.parse(cookieData); // Parse the JSON string back to an object
        visualizer.shader = restoredData;  // Store it in the window object
  
        // Example: Do something with the restored data
        console.log("Data restored:", restoredData);
    } else {
        alert("No saved data found.");
    }
  }