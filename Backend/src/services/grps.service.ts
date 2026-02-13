import mongoose from "mongoose";
import { Grps } from "../models/groups.model";

export class GrpsService {

    static async Listallgrps(){
        return await Grps.find();
    }
}