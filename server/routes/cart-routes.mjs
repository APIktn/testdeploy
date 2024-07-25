import { Router } from "express";
import supabase from "../utils/db.mjs";
import { authenticateToken } from "../middlewares/authVerify.mjs";

const cartsRouter = Router();

//---------Get CART ID------////
cartsRouter.get("/:service_name", async (req, res) => {
  const cartIDFromClient = req.params.service_name;

  let result;
  try {
    result = await supabase
      .from("services") // Replace 'carts' with the actual table name
      .select("*,service_list(*)")
      .eq("service_name", cartIDFromClient);
  } catch {
    return res.status(500).json({
      message:
        "Server could not read cart because of a database connection error",
    });
  }

  if (!result.data || result.data.length === 0) {
    return res.status(404).json({
      "Not Found": "Cart not found",
    });
  }

  return res.status(200).json({
    OK: "Successfully retrieved the cart.",
    data: result.data,
  });
});

//---------Calculate Net Price------////
cartsRouter.post("/:service_name", (req, res) => {
  const { summaryData } = req.body;
  let netPrice = 0;

  summaryData.forEach((item) => {
    netPrice += item.price * item.count;
  });

  console.log("Calculated net price:", netPrice);
  res.json({ netPrice });
});

//---------Store Bill Info------////
cartsRouter.post("/:service_name/bill", authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;

    // Insert order and get order_id
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{ user_id }])
      .select();

    if (orderError) {
      console.error("Error inserting order:", orderError);
      return res
        .status(500)
        .json({ message: "Error inserting order", error: orderError.message });
    }

    if (!orderData || orderData.length === 0) {
      console.error("No data returned from order insertion");
      throw new Error("No data returned from order insertion");
    }

    console.log("Order inserted:", orderData);

    const order_id = orderData[0].order_id;

    const billInfo = req.body;

    const {
      serviceId,
      order,
      date,
      times,
      detail,
      subdistrict,
      district,
      province,
      netPrice,
      moredetail,
    } = billInfo;

    const orderDetails = order.serviceInfo.map((item) => ({
      order_id, // Associate each order detail with the created order
      service_id: serviceId, // Ensure this is correctly populated
      service_lists: item.service_name,
      quantity_per_order: item.service_amount,
      order_date: date,
      time: times,
      ad_detail: detail,
      ad_subdistrict: subdistrict,
      ad_district: district,
      ad_province: province,
      ad_moredetail: moredetail,
      total_amount: netPrice,
    }));

    // Insert order details
    const { data: orderDetailData, error: orderDetailError } = await supabase
      .from("orderdetails")
      .insert(orderDetails);

    if (orderDetailError) {
      console.error("Error inserting order details:", orderDetailError);
      return res.status(500).json({
        message: "Error inserting order details",
        error: orderDetailError.message,
      });
    }

    console.log("Order details inserted:", orderDetailData);

    res.status(200).json({
      message: "Bill info received and stored successfully",
      orderDetailData,
    });
  } catch (error) {
    console.error("Error inserting order details:", error);
    res
      .status(500)
      .json({ message: "Server error, could not store bill info" });
  }
});

export default cartsRouter;
