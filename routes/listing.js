const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync=require("../utils/wrapAsync.js");
const ExpressError=require("../utils/ExpressError.js");
const {listingSchema}=require("../schema.js");
const Listing = require("../models/listing.js");
const { isLoggedIn , isOwner} = require("../middleware.js")

const multer = require('multer');
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = "pk.eyJ1IjoiYWpheS0xMjM0IiwiYSI6ImNseXNvcnIwMDBpNHYycXM2bWdnYmZxaWwifQ.yMKHa9sPYMN6nnCy_bvD8A";
const geocodingClient= mbxGeocoding({ accessToken: mapToken });


const validateListing=(req,res,next)=>{
    let {error}=listingSchema.validate(req.body);
    if(error){
      const errmsg=error.details.map((el)=>el.message).join(",");
      throw new ExpressError(400,errmsg)
    }else{
      next();
    }
  };

//home
router.get("/",(req,res)=>{
  res.render("listings/home.ejs");
})

//Index Route
router.get("/", wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
  }));
  
  //New Route
  router.get("/new", isLoggedIn ,(req, res) => {
    res.render("listings/new.ejs");
  });
  
  //Show Route
  router.get("/:id", wrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate("owner");
    if(!listing){
        req.flash("error","Listing doesnot exist")
        res.redirect("/listings")
    }
    res.render("listings/show.ejs", { listing });
  }));
  
  //Create Route
  router.post("/", isLoggedIn, upload.single('listing[image]'),validateListing ,wrapAsync(async (req, res,next) => {
    let response=await geocodingClient.forwardGeocode({
      query:req.body.listing.location,
      limit:1,
    }).send();

    let url=req.file.path;
    let filename=req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner=req.user._id;
    newListing.image={url,filename}
    newListing.geometry=response.body.features[0].geometry;
    let savedListing=await newListing.save();
    console.log(savedListing);
    req.flash("success","New Listing created");
    res.redirect("/listings");
  }));
  
  //Edit Route
  router.get("/:id/edit", isLoggedIn, isOwner , wrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if(!listing){
        req.flash("error","Listing doesnot exist")
        res.redirect("/listings")
    }
    res.render("listings/edit.ejs", { listing });
  }));
  
  //Update Route
  router.put("/:id", isLoggedIn, isOwner , upload.single('listing[image]') , validateListing ,wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    if(typeof req.file !== "undefined"){
    let url=req.file.path;
    let filename=req.file.filename;
    listing.image={url,filename};
    await listing.save()
    }
    req.flash("success","Listing updated");
    res.redirect(`/listings/${id}`);
  }));
  
  //Delete Route
  router.delete("/:id", isLoggedIn, isOwner ,wrapAsync(async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success","Listing deleted");
    res.redirect("/listings");
  }));

  module.exports=router;