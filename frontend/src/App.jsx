import { useEffect, useState } from "react";
import axios from "axios";

export default function App() {
  const [msg, setMsg] = useState("loading...");

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/api/ping/")
      .then((res) => setMsg(res.data.message))
      .catch(() => setMsg("connection failed"));
  }, []);

  return <h1>{msg}</h1>;
}
