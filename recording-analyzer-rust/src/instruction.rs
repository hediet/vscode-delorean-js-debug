use derive_more::From;
use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Clone, From, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Instruction {
    SetModuleId { module_id: ModuleId },
    CallFunction { function_id: FunctionId },
    ReachedBlock { block_id: u32 },
    ReturnFunction,
    SetModuleInfo { module_info_json: String },
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, From, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ModuleId(pub u32);

#[derive(Debug, PartialEq, Eq, Clone, Copy, From, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FunctionId(pub u32);

#[derive(Debug, PartialEq, Eq, Clone, Copy, From, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BlockId(pub u32);

impl Instruction {
    pub fn from_iter<I>(iter: &mut I) -> Option<Instruction>
    where
        I: Iterator<Item = u8>,
    {
        let first_byte = iter.next()?;
        match first_byte {
            0b00_000000..=0b00_111111 => {
                let module_id = read_u32_vl(iter, first_byte).into();
                Some(Instruction::SetModuleId { module_id })
            }
            0b01_000000..=0b01_111111 => {
                let function_id = read_u32_vl(iter, first_byte).into();
                Some(Instruction::CallFunction { function_id })
            }
            0b10_000000..=0b10_111111 => {
                let block_id = read_u32_vl(iter, first_byte).into();
                Some(Instruction::ReachedBlock { block_id })
            }
            0b11_000000 => Some(Instruction::ReturnFunction),
            0b11_000001 => {
                let len = read_u32(iter);
                let data = iter.take(len as usize).collect::<Vec<_>>();
                let module_info_json = String::from_utf8(data).unwrap();
                Some(Instruction::SetModuleInfo { module_info_json })
            }
            _ => panic!("Invalid instruction"),
        }
    }
}

fn read_u32<I>(iter: &mut I) -> u32
where
    I: Iterator<Item = u8>,
{
    let number = ((iter.next().unwrap() as u32) << 24)
        | ((iter.next().unwrap() as u32) << 16)
        | ((iter.next().unwrap() as u32) << 8)
        | iter.next().unwrap() as u32;
    number
}

fn read_u32_vl<I>(iter: &mut I, first_byte: u8) -> u32
where
    I: Iterator<Item = u8>,
{
    let first_byte = first_byte & 0b00_111111;

    match first_byte {
        0b0011_1101 => {
            // read 1 byte
            let number = iter.next().unwrap() as u32;
            number
        }
        0b0011_1110 => {
            // read 2 bytes
            let byte_0 = iter.next().unwrap();
            let byte_1 = iter.next().unwrap();
            let number = ((byte_0 as u32) << 0) | ((byte_1 as u32) << 8);
            number
        }
        0b0011_1111 => {
            // read 3 bytes
            let byte_0 = iter.next().unwrap();
            let byte_1 = iter.next().unwrap();
            let byte_2 = iter.next().unwrap();

            let number = ((byte_0 as u32) << 0)
                | ((byte_1 as u32) << 8)
                | ((byte_2 as u32) << 16);
            number
        }
        _ => first_byte as u32,
    }
}

struct InstructionIter<I> {
    iter: I,
}

// Implement the Iterator trait for the struct
impl<I> Iterator for InstructionIter<I>
where
    I: Iterator<Item = u8>,
{
    type Item = Instruction;

    fn next(&mut self) -> Option<Self::Item> {
        Instruction::from_iter(&mut self.iter)
    }
}

pub fn create_instruction_iter<I>(iter: I) -> impl Iterator<Item = Instruction>
where
    I: Iterator<Item = u8>,
{
    InstructionIter { iter }
}
