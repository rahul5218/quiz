//jshint esversion:6
const generateMessage=(text)=>{
  return{
    text,
    createdAt:new Date().getTime()
  };
};

module.exports={
  generateMessage
};
