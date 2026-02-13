import express from "express";
import { viewgrpscontroller,creategroupcontroller,joingroupcontroller,leavegroupcontroller,deletegroupcontroller } from "../../controllers/grps.controller";
import { validateJWT } from "../../middlewares/validateJWT";

const grps_router = express.Router();

grps_router.post("/create", validateJWT,creategroupcontroller);
grps_router.get("/view", validateJWT,viewgrpscontroller);
grps_router.post("/join", validateJWT,joingroupcontroller);
grps_router.post("/leave", validateJWT,leavegroupcontroller);
grps_router.delete("/delete", validateJWT,deletegroupcontroller);

export { grps_router };
